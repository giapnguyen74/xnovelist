import { Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface BeatAnchorOptions {
  onBeatClick?: (id: string) => void;
  /** Fired right after a brand-new beat anchor is inserted into the doc. */
  onBeatCreated?: (id: string) => void;
  getBeatData?: (id: string) => { type: string; length: number; intent: string; mode?: 'write_beat' | 'continue' } | null;
}

export const beatPluginKey = new PluginKey('beatDuplicateCheck');

function findBeatMatches(doc: any, getBeatData?: (id: string) => any) {
  const decorations: Decoration[] = [];
  if (!getBeatData) return DecorationSet.empty;

  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'beatAnchor' && !node.attrs.isDuplicate) {
      const startPos = pos + node.nodeSize;
      const nextNode = doc.nodeAt(startPos);
      if (nextNode && nextNode.isBlock && nextNode.type.name !== 'beatAnchor') {
        // Decorate the adjacent block node as the bound content
        decorations.push(
          Decoration.node(startPos, startPos + nextNode.nodeSize, {
            class: 'beat-matched-block',
          })
        );
      }
    }
    return true;
  });

  decorations.sort((a, b) => a.from - b.from);
  return DecorationSet.create(doc, decorations);
}

export const BeatAnchor = Node.create<BeatAnchorOptions>({
  name: 'beatAnchor',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      onBeatClick: undefined,
      onBeatCreated: undefined,
      getBeatData: undefined,
    };
  },

  addAttributes() {
    return {
      id: {
        default: null,
      },
      isDuplicate: {
        default: false,
      },
      beatType: {
        default: 'action',
      },
      beatMode: {
        default: 'write_beat',
      },
      beatLength: {
        default: 400,
      },
      beatIntent: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-beat-id]',
        getAttrs: (dom) => ({
          id: (dom as HTMLElement).getAttribute('data-beat-id'),
          beatType: (dom as HTMLElement).getAttribute('data-beat-type') || 'action',
          beatMode: (dom as HTMLElement).getAttribute('data-beat-mode') || 'write_beat',
          beatLength: Number((dom as HTMLElement).getAttribute('data-beat-length') || '400'),
          beatIntent: (dom as HTMLElement).getAttribute('data-beat-intent') || '',
        }),
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'div',
      {
        'data-beat-id': node.attrs.id,
        'data-beat-type': node.attrs.beatType,
        'data-beat-mode': node.attrs.beatMode,
        'data-beat-length': String(node.attrs.beatLength),
        'data-beat-intent': node.attrs.beatIntent,
        class: `beat-anchor ${node.attrs.isDuplicate ? 'is-duplicate' : ''}`,
      },
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`:::beat{${node.attrs.id}}\n\n`);
        },
        parse: {
          setup(markdownit: any) {
            markdownit.block.ruler.before('paragraph', 'beatAnchor', (state: any, startLine: number, endLine: number, silent: boolean) => {
              const pos = state.bMarks[startLine] + state.tShift[startLine];
              const max = state.eMarks[startLine];
              const line = state.src.slice(pos, max).trim();
              const match = /^:::beat\{([^}]+)\}$/.exec(line);
              if (match) {
                if (silent) return true;
                const token = state.push('beatAnchor', 'div', 0);
                token.block = true;
                token.markup = ':::beat';
                token.info = match[1];
                state.line = startLine + 1;
                return true;
              }
              return false;
            });

            markdownit.renderer.rules.beatAnchor = (tokens: any, idx: number) => {
              const id = tokens[idx].info;
              return `<div class="beat-anchor" data-beat-id="${id}"></div>`;
            };
          },
        },
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-b': () => {
        const { editor } = this;
        const id = `beat-${Date.now()}`;
        const { state } = editor;
        const { $from } = state.selection;
        // If we're inside a non-empty paragraph, split first so the beat
        // starts on its own block (never inline with existing text).
        const inNonEmptyBlock = $from.parent.type.name === 'paragraph' && $from.parent.textContent.length > 0;
        if (inNonEmptyBlock) {
          editor.chain()
            .splitBlock()
            .insertContent([
              { type: this.name, attrs: { id } },
              { type: 'paragraph' },
            ])
            .run();
        } else {
          editor.chain()
            .insertContent([
              { type: this.name, attrs: { id } },
              { type: 'paragraph' },
            ])
            .run();
        }
        this.options.onBeatCreated?.(id);
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const { options } = this;
    return [
      new Plugin({
        key: beatPluginKey,
        appendTransaction(transactions, oldState, newState) {
          // Check if document changed or attributes need updating
          let docChanged = false;
          for (const tr of transactions) {
            if (tr.docChanged) docChanged = true;
          }
          if (!docChanged) return null;

          const tr = newState.tr;
          const seenIds = new Set<string>();
          let hasModifications = false;

          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'beatAnchor') {
              const id = node.attrs.id;
              const isDupe = seenIds.has(id);
              seenIds.add(id);

              if (node.attrs.isDuplicate !== isDupe) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  isDuplicate: isDupe,
                });
                hasModifications = true;
              }
            }
          });

          return hasModifications ? tr : null;
        },
        state: {
          init(config, state) {
            return findBeatMatches(state.doc, options.getBeatData);
          },
          apply(tr, value, oldState, newState) {
            return findBeatMatches(newState.doc, options.getBeatData);
          },
        },
        props: {
          decorations(state) {
            return beatPluginKey.getState(state) || DecorationSet.empty;
          },
        },
      }),
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }: { node: any; getPos: any; editor: any }) => {
      const dom = document.createElement('div');
      const id = node.attrs.id;
      let latestNode = node;
      let lastWordCount = -1;

      dom.style.userSelect = 'none';

      // Word count of the adjacent bound narrative block. Beats are single-paragraph
      // by design, so the one block after the header is the whole beat body.
      const computeBodyWordCount = (currNode: typeof node): number => {
        try {
          const absolutePos = typeof getPos === 'function' ? getPos() : null;
          if (absolutePos === null || absolutePos === undefined) return 0;
          const nextNode = editor.state.doc.nodeAt(absolutePos + currNode.nodeSize);
          if (nextNode && nextNode.isBlock && nextNode.type.name !== 'beatAnchor') {
            const text = nextNode.textContent || '';
            return text.trim().split(/\s+/).filter(Boolean).length;
          }
        } catch (err) {
          console.error('Failed to compute body word count:', err);
        }
        return 0;
      };

      const renderDOM = (currNode: typeof node) => {
        const isDuplicate = currNode.attrs.isDuplicate;
        dom.className = `beat-anchor-view-container ${isDuplicate ? 'is-duplicate' : ''}`;

        if (isDuplicate) {
          lastWordCount = -1;
          dom.innerHTML = `
            <div class="beat-anchor-warning-box">
              <span class="warning-icon">⚠</span>
              <span class="warning-text">Duplicate Beat ID (${id}) — Inert duplicate. Please remove.</span>
            </div>
          `;
        } else {
          // Read directly from node attrs — always in sync with the ProseMirror doc.
          const mode: string = currNode.attrs.beatMode || 'write_beat';
          const modeStr = mode === 'continue' ? 'Continue' : 'Beat';
          const rawType: string = currNode.attrs.beatType || 'action';
          const typeStr = rawType.charAt(0).toUpperCase() + rawType.slice(1);
          const length: number = currNode.attrs.beatLength || 400;
          const intent: string = currNode.attrs.beatIntent || '';

          const wordCount = computeBodyWordCount(currNode);
          lastWordCount = wordCount;
          const lengthStr = wordCount > 0 ? `${wordCount} words · target ~${length}` : `~${length} words`;
          // Call-to-action label: invites the click that opens the Agent Panel.
          const ctaLabel = wordCount > 0 ? 'Edit with AI' : (mode === 'continue' ? 'Continue with AI' : 'Write with AI');

          let intentPreview = '';
          if (intent) {
            const trimmed = intent.trim().replace(/\s+/g, ' ');
            if (trimmed) {
              const limit = 40;
              intentPreview = trimmed.length > limit ? trimmed.slice(0, limit) + '...' : trimmed;
            }
          }

          dom.innerHTML = `
            <div class="beat-anchor-active-box">
              <div class="beat-header-row">
                <span class="beat-icon">⚡</span>
                <span class="beat-badge beat-mode-badge ${mode === 'continue' ? 'mode-continue' : 'mode-beat'}">${modeStr}</span>
                <span class="beat-badge">${typeStr}</span>
                <span class="beat-length">${lengthStr}</span>
                ${intentPreview ? `<span class="beat-header-intent-preview">"${intentPreview}"</span>` : ''}
                <span class="beat-cta-btn">✦ ${ctaLabel}</span>
              </div>
            </div>
          `;
        }
      };

      // Initial render
      renderDOM(node);

      dom.addEventListener('click', (e) => {
        e.preventDefault();
        if (!latestNode.attrs.isDuplicate) {
          this.options.onBeatClick?.(id);
        }
      });

      // Re-render only when the body word count actually changes. Typing within a
      // word doesn't cross a whitespace boundary, so most keystrokes skip the rewrite.
      const handleUpdate = () => {
        if (latestNode.attrs.isDuplicate) return;
        if (computeBodyWordCount(latestNode) !== lastWordCount) {
          renderDOM(latestNode);
        }
      };
      editor.on('update', handleUpdate);

      return {
        dom,
        update: (newNode) => {
          latestNode = newNode;
          renderDOM(newNode);
          return true;
        },
        destroy: () => {
          editor.off('update', handleUpdate);
        },
      };
    };
  },
});
