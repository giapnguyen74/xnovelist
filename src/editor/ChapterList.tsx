import React, { useState } from 'react';
import { Plus, Trash2, Search, ChevronDown, ChevronRight, Users, MapPin, Feather, Compass } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { Chapter, Character, Location } from '../storage/schemas';

interface ChapterListProps {
  chapters: Chapter[];
  activeChapterId: string;
  chapterOrder: string[];
  wordCounts: Record<string, number>;
  onSelectChapter: (id: string) => void;
  onCreateChapter: () => void;

  onDeleteChapter: (id: string) => void;
  onReorderChapters: (newOrder: string[]) => void;
  
  // Story Bible props for quick navigation
  characters?: Character[];
  locations?: Location[];
  onSelectBibleItem?: (type: 'characters' | 'locations', id: string) => void;
}

export default function ChapterList({
  chapters,
  activeChapterId,
  chapterOrder,
  wordCounts,
  onSelectChapter,
  onCreateChapter,
  onDeleteChapter,
  onReorderChapters,
  characters = [],
  locations = [],
  onSelectBibleItem,
}: ChapterListProps) {
  const { t } = useTranslation();

  
  const [sidebarTab, setSidebarTab] = useState<'outline' | 'bible'>('outline');
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionsExpanded, setSectionsExpanded] = useState<Record<string, boolean>>({
    characters: true,
    locations: true,
    objects: false,
    others: false,
  });

  const sortedChapters = [...chapterOrder]
    .map((id) => chapters.find((c) => c.id === id))
    .filter((c): c is Chapter => !!c);





  return (
    <div className="flex flex-col h-full bg-[var(--sidebar-bg)] border-r border-[var(--border)] select-none">
      {/* Sidebar Tabs */}
      <div className="h-[53px] px-2 border-b border-[var(--border)] flex items-center justify-between gap-1 flex-shrink-0 bg-[var(--sidebar-bg)]">
        <button
          onClick={() => setSidebarTab('outline')}
          className={`flex-1 py-1.5 rounded text-xs font-semibold text-center transition-all cursor-pointer ${
            sidebarTab === 'outline'
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[var(--foreground)] opacity-70 hover:opacity-100 hover:bg-[var(--border)]/40'
          }`}
        >
          {t('outline')}
        </button>
        <button
          onClick={() => setSidebarTab('bible')}
          className={`flex-1 py-1.5 rounded text-xs font-semibold text-center transition-all cursor-pointer ${
            sidebarTab === 'bible'
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'text-[var(--foreground)] opacity-70 hover:opacity-100 hover:bg-[var(--border)]/40'
          }`}
        >
          {t('storyBible')}
        </button>
      </div>

      {sidebarTab === 'outline' ? (
        <>
          <div className="px-3 py-2 border-b border-[var(--border)]/40 flex items-center justify-between flex-shrink-0 bg-[var(--sidebar-bg)]">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">{t('chapters')}</span>
            <button
              onClick={onCreateChapter}
              className="p-1 rounded hover:bg-[var(--border)] text-[var(--foreground)] transition-colors cursor-pointer"
              title={t('addChapter')}
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sortedChapters.length === 0 ? (
              <div className="text-center text-xs opacity-50 p-4">{t('noChapters')}</div>
            ) : (
              sortedChapters.map((chapter, index) => {
                const isActive = chapter.id === activeChapterId;
                const wCount = wordCounts[chapter.id] || 0;

                return (
                  <div
                    key={chapter.id}
                    onClick={() => onSelectChapter(chapter.id)}
                    className={`group flex flex-col p-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
                      isActive
                        ? 'bg-[var(--accent)] text-white shadow-sm'
                        : 'hover:bg-[var(--border)] text-[var(--foreground)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate flex-1 pr-2 flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold font-mono shrink-0 ${isActive ? 'opacity-60' : 'opacity-40'}`}>Ch.{index + 1}</span>
                        <span className="truncate">{chapter.title}</span>
                      </span>

                      <div className="flex sm:hidden sm:group-hover:flex items-center gap-1">

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteChapter(chapter.id);
                          }}
                          className={`p-0.5 rounded hover:bg-red-500/20 transition-colors ${
                            isActive ? 'text-white hover:bg-red-600' : 'text-red-500 hover:text-red-700'
                          }`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[11px] opacity-70">
                      <span>
                        {wCount} {t('wordCount')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          {/* Search Input */}
          <div className="p-3 border-b border-[var(--border)]/40 flex-shrink-0 bg-[var(--sidebar-bg)]">
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-2.5 text-[var(--foreground)] opacity-50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchEntries')}
                className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-8 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
              />
            </div>
          </div>

          {/* Collapsible Categories */}
          <div className="flex-1 overflow-y-auto">
            {/* Characters Section */}
            <div className="border-b border-[var(--border)]/40">
              <button
                onClick={() => setSectionsExpanded(prev => ({ ...prev, characters: !prev.characters }))}
                className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-[var(--border)]/30 transition-colors text-[var(--foreground)] opacity-85 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Users size={12} className="text-[var(--accent)]" />
                  {t('characters')}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] opacity-60">
                  {characters.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length} {t('entries')}
                  {sectionsExpanded.characters ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              </button>
              
              {sectionsExpanded.characters && (
                <div className="p-1 space-y-0.5 bg-[var(--sidebar-bg)]">
                  {characters
                    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(char => (
                      <div
                        key={char.id}
                        onClick={() => onSelectBibleItem?.('characters', char.id)}
                        className="px-6 py-1.5 text-xs rounded hover:bg-[var(--border)] cursor-pointer text-[var(--foreground)] opacity-90 truncate transition-colors"
                      >
                        {char.name}
                      </div>
                    ))}
                  {characters.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="px-6 py-2 text-[10px] opacity-40 italic">{t('noCharactersFound')}</div>
                  )}
                </div>
              )}
            </div>

            {/* Locations Section */}
            <div className="border-b border-[var(--border)]/40">
              <button
                onClick={() => setSectionsExpanded(prev => ({ ...prev, locations: !prev.locations }))}
                className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-[var(--border)]/30 transition-colors text-[var(--foreground)] opacity-85 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-[var(--accent)]" />
                  {t('locations')}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] opacity-60">
                  {locations.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase())).length} {t('entries')}
                  {sectionsExpanded.locations ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              </button>
              
              {sectionsExpanded.locations && (
                <div className="p-1 space-y-0.5 bg-[var(--sidebar-bg)]">
                  {locations
                    .filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(loc => (
                      <div
                        key={loc.id}
                        onClick={() => onSelectBibleItem?.('locations', loc.id)}
                        className="px-6 py-1.5 text-xs rounded hover:bg-[var(--border)] cursor-pointer text-[var(--foreground)] opacity-90 truncate transition-colors"
                      >
                        {loc.name}
                      </div>
                    ))}
                  {locations.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                    <div className="px-6 py-2 text-[10px] opacity-40 italic">{t('noLocationsFound')}</div>
                  )}
                </div>
              )}
            </div>

            {/* Objects/Items Section (Mock to match screenshot design) */}
            <div className="border-b border-[var(--border)]/40">
              <button
                onClick={() => setSectionsExpanded(prev => ({ ...prev, objects: !prev.objects }))}
                className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-[var(--border)]/30 transition-colors text-[var(--foreground)] opacity-85 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Compass size={12} className="text-[var(--accent)] opacity-80" />
                  {t('objectsItems')}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] opacity-60">
                  0 {t('entries')}
                  {sectionsExpanded.objects ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              </button>
              
              {sectionsExpanded.objects && (
                <div className="px-6 py-3 text-[10px] opacity-40 italic">{t('noObjectsDefined')}</div>
              )}
            </div>

            {/* Others Section (Mock to match screenshot design) */}
            <div className="border-b border-[var(--border)]/40">
              <button
                onClick={() => setSectionsExpanded(prev => ({ ...prev, others: !prev.others }))}
                className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-semibold hover:bg-[var(--border)]/30 transition-colors text-[var(--foreground)] opacity-85 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Feather size={12} className="text-[var(--accent)] opacity-80" />
                  {t('others')}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] opacity-60">
                  0 {t('entries')}
                  {sectionsExpanded.others ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              </button>
              
              {sectionsExpanded.others && (
                <div className="px-6 py-3 text-[10px] opacity-40 italic">{t('noCustomCategories')}</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
