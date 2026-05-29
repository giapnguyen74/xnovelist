/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-this-alias */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface BibleLinkageOptions {
  characters: any[];
  locations: any[];
  enabled: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bibleLinkage: {
      updateBibleLinkage: (config: { characters: any[]; locations: any[]; enabled: boolean }) => ReturnType;
    }
  }
}

export const bibleLinkagePluginKey = new PluginKey('bibleLinkage');

function findBibleMatches(doc: any, characters: any[], locations: any[], enabled: boolean) {
  if (!enabled) return DecorationSet.empty;
  
  const decos: Decoration[] = [];
  const matchers: { text: string; className: string }[] = [];
  
  characters.forEach(char => {
    if (char.name && char.name.trim()) {
      matchers.push({ text: char.name.trim(), className: 'character-highlight' });
    }
    if (Array.isArray(char.aliases)) {
      char.aliases.forEach((alias: string) => {
        if (alias && alias.trim()) {
          matchers.push({ text: alias.trim(), className: 'character-highlight' });
        }
      });
    }
  });

  locations.forEach(loc => {
    if (loc.name && loc.name.trim()) {
      matchers.push({ text: loc.name.trim(), className: 'location-highlight' });
    }
    if (Array.isArray(loc.aliases)) {
      loc.aliases.forEach((alias: string) => {
        if (alias && alias.trim()) {
          matchers.push({ text: alias.trim(), className: 'location-highlight' });
        }
      });
    }
  });

  if (matchers.length === 0) return DecorationSet.empty;

  // Sort matchers by length descending to match longer strings first if there are nested overlaps
  matchers.sort((a, b) => b.text.length - a.text.length);

  doc.descendants((node: any, pos: number) => {
    if (node.isText) {
      const text = node.text || '';
      const matchedIndices = new Array(text.length).fill(false);
      
      matchers.forEach(matcher => {
        const escaped = matcher.text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        // Word boundary, case-sensitive
        const regex = new RegExp(`\\b${escaped}\\b`, 'g');
        
        let match;
        while ((match = regex.exec(text)) !== null) {
          const startIdx = match.index;
          const endIdx = match.index + match[0].length;
          
          let alreadyMatched = false;
          for (let i = startIdx; i < endIdx; i++) {
            if (matchedIndices[i]) {
              alreadyMatched = true;
              break;
            }
          }
          
          if (!alreadyMatched) {
            for (let i = startIdx; i < endIdx; i++) {
              matchedIndices[i] = true;
            }
            
            decos.push(
              Decoration.inline(pos + startIdx, pos + endIdx, {
                class: matcher.className,
              })
            );
          }
          
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }
      });
    }
  });

  decos.sort((a, b) => a.from - b.from);
  return DecorationSet.create(doc, decos);
}

export const BibleLinkage = Extension.create<BibleLinkageOptions>({
  name: 'bibleLinkage',

  addOptions() {
    return {
      characters: [],
      locations: [],
      enabled: true,
    };
  },

  addProseMirrorPlugins() {
    const extension = this;
    
    return [
      new Plugin({
        key: bibleLinkagePluginKey,
        state: {
          init() {
            return {
              characters: extension.options.characters || [],
              locations: extension.options.locations || [],
              enabled: extension.options.enabled !== false,
              decorations: DecorationSet.empty,
            };
          },
          apply(tr, value, oldState, newState) {
            const meta = tr.getMeta(bibleLinkagePluginKey);
            let { characters, locations, enabled } = value;
            let forceUpdate = false;

            if (meta) {
              if (meta.characters !== undefined) characters = meta.characters;
              if (meta.locations !== undefined) locations = meta.locations;
              if (meta.enabled !== undefined) enabled = meta.enabled;
              forceUpdate = true;
            }

            const docChanged = tr.docChanged;

            if (docChanged || forceUpdate) {
              const decorations = findBibleMatches(newState.doc, characters, locations, enabled);
              return {
                characters,
                locations,
                enabled,
                decorations,
              };
            }

            return value;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations || DecorationSet.empty;
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      updateBibleLinkage: (config: { characters: any[]; locations: any[]; enabled: boolean }) => ({ tr, dispatch }) => {
        if (dispatch) {
          tr.setMeta(bibleLinkagePluginKey, config);
        }
        return true;
      },
    };
  },
});
