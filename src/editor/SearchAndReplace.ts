/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-this-alias */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface SearchAndReplaceOptions {
  onResults?: (results: { count: number; index: number }) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchAndReplace: {
      setSearchQuery: (query: string) => ReturnType;
      setCaseSensitive: (caseSensitive: boolean) => ReturnType;
      setWholeWord: (wholeWord: boolean) => ReturnType;
      goToNextMatch: () => ReturnType;
      goToPrevMatch: () => ReturnType;
      replaceSingle: (replaceTerm: string) => ReturnType;
      replaceAll: (replaceTerm: string) => ReturnType;
    }
  }
}

const searchPluginKey = new PluginKey('searchAndReplace');

function findMatches(doc: any, query: string, caseSensitive: boolean, wholeWord: boolean) {
  if (!query) return [];
  const matches: { start: number; end: number }[] = [];
  
  doc.descendants((node: any, pos: number) => {
    if (node.isText) {
      const text = node.text || '';
      let flags = 'g';
      if (!caseSensitive) flags += 'i';
      
      // Escape special regex characters in query
      let escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      if (wholeWord) {
        escapedQuery = `\\b${escapedQuery}\\b`;
      }
      
      const regex = new RegExp(escapedQuery, flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: pos + match.index,
          end: pos + match.index + match[0].length,
        });
        if (match.index === regex.lastIndex) {
          regex.lastIndex++; // Avoid infinite loops for empty matches
        }
      }
    }
  });
  
  return matches;
}

export const SearchAndReplace = Extension.create<SearchAndReplaceOptions>({
  name: 'searchAndReplace',

  addOptions() {
    return {
      onResults: undefined,
    };
  },

  addStorage() {
    return {
      searchQuery: '',
      caseSensitive: false,
      wholeWord: false,
      currentIndex: -1,
      matches: [] as { start: number; end: number }[],
    };
  },

  addProseMirrorPlugins() {
    const extension = this;
    
    return [
      new Plugin({
        key: searchPluginKey,
        state: {
          init() {
            return {
              searchQuery: '',
              caseSensitive: false,
              wholeWord: false,
              currentIndex: -1,
              matches: [] as { start: number; end: number }[],
              decorations: DecorationSet.empty,
            };
          },
          apply(tr, value, oldState, newState) {
            const searchMeta = tr.getMeta(searchPluginKey);
            let { searchQuery, caseSensitive, wholeWord, currentIndex, matches } = value;
            let forceUpdate = false;

            if (searchMeta) {
              if (searchMeta.searchQuery !== undefined) searchQuery = searchMeta.searchQuery;
              if (searchMeta.caseSensitive !== undefined) caseSensitive = searchMeta.caseSensitive;
              if (searchMeta.wholeWord !== undefined) wholeWord = searchMeta.wholeWord;
              if (searchMeta.currentIndex !== undefined) currentIndex = searchMeta.currentIndex;
              forceUpdate = true;
            }

            const docChanged = tr.docChanged;

            if (docChanged || forceUpdate) {
              // Re-run matching
              matches = findMatches(newState.doc, searchQuery, caseSensitive, wholeWord);
              
              // Bound current index
              if (matches.length === 0) {
                currentIndex = -1;
              } else if (currentIndex < 0 || currentIndex >= matches.length) {
                currentIndex = 0;
              }

              // Build decorations
              const decos = matches.map((m, idx) => {
                const isActive = idx === currentIndex;
                return Decoration.inline(m.start, m.end, {
                  class: isActive ? 'search-match-active' : 'search-match',
                });
              });

              // Notify callback
              if (extension.options.onResults) {
                extension.options.onResults({
                  count: matches.length,
                  index: currentIndex,
                });
              }

              // Update storage
              extension.storage.searchQuery = searchQuery;
              extension.storage.caseSensitive = caseSensitive;
              extension.storage.wholeWord = wholeWord;
              extension.storage.currentIndex = currentIndex;
              extension.storage.matches = matches;

              return {
                searchQuery,
                caseSensitive,
                wholeWord,
                currentIndex,
                matches,
                decorations: DecorationSet.create(newState.doc, decos),
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
      setSearchQuery: (query: string) => ({ tr, dispatch }) => {
        if (dispatch) {
          tr.setMeta(searchPluginKey, { searchQuery: query, currentIndex: 0 });
        }
        return true;
      },
      setCaseSensitive: (caseSensitive: boolean) => ({ tr, dispatch }) => {
        if (dispatch) {
          tr.setMeta(searchPluginKey, { caseSensitive });
        }
        return true;
      },
      setWholeWord: (wholeWord: boolean) => ({ tr, dispatch }) => {
        if (dispatch) {
          tr.setMeta(searchPluginKey, { wholeWord });
        }
        return true;
      },
      goToNextMatch: () => ({ tr, dispatch, state }) => {
        const pluginState = searchPluginKey.getState(state);
        if (!pluginState || pluginState.matches.length === 0) return false;
        if (dispatch) {
          const nextIndex = (pluginState.currentIndex + 1) % pluginState.matches.length;
          const activeMatch = pluginState.matches[nextIndex];
          if (activeMatch) {
            tr.setSelection(TextSelection.create(state.doc, activeMatch.start, activeMatch.end));
            tr.scrollIntoView();
          }
          tr.setMeta(searchPluginKey, { currentIndex: nextIndex });
        }
        return true;
      },
      goToPrevMatch: () => ({ tr, dispatch, state }) => {
        const pluginState = searchPluginKey.getState(state);
        if (!pluginState || pluginState.matches.length === 0) return false;
        if (dispatch) {
          const prevIndex = (pluginState.currentIndex - 1 + pluginState.matches.length) % pluginState.matches.length;
          const activeMatch = pluginState.matches[prevIndex];
          if (activeMatch) {
            tr.setSelection(TextSelection.create(state.doc, activeMatch.start, activeMatch.end));
            tr.scrollIntoView();
          }
          tr.setMeta(searchPluginKey, { currentIndex: prevIndex });
        }
        return true;
      },
      replaceSingle: (replaceTerm: string) => ({ tr, dispatch, state }) => {
        const pluginState = searchPluginKey.getState(state);
        if (!pluginState || pluginState.currentIndex < 0) return false;
        
        const activeMatch = pluginState.matches[pluginState.currentIndex];
        if (!activeMatch) return false;

        if (dispatch) {
          tr.insertText(replaceTerm, activeMatch.start, activeMatch.end);
        }
        return true;
      },
      replaceAll: (replaceTerm: string) => ({ tr, dispatch, state }) => {
        const pluginState = searchPluginKey.getState(state);
        if (!pluginState || pluginState.matches.length === 0) return false;

        if (dispatch) {
          const reversedMatches = [...pluginState.matches].reverse();
          reversedMatches.forEach(m => {
            tr.insertText(replaceTerm, m.start, m.end);
          });
        }
        return true;
      },
    };
  },
});
