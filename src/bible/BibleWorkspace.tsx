import React, { useState } from 'react';
import { Users, MapPin, Feather, Compass, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { Character, Location, Style } from '../storage/schemas';

interface BibleWorkspaceProps {
  characters: { schemaVersion: 1; characters: Character[] };
  locations: { schemaVersion: 1; locations: Location[] };
  style: Style;
  continuityList: Record<string, string>; // chapterId -> markdown
  chapters: { id: string; title: string }[];
  activeChapterId: string;
  onUpdateCharacters: (chars: Character[]) => void;
  onUpdateLocations: (locs: Location[]) => void;
  onUpdateStyle: (style: Style) => void;
  onUpdateContinuity: (chapterId: string, content: string) => void;
  
  // Lifted selection states for story bible quick-nav
  bibleTab?: 'characters' | 'locations' | 'style' | 'continuity';
  onChangeBibleTab?: (tab: 'characters' | 'locations' | 'style' | 'continuity') => void;
  selectedCharId?: string | null;
  onSelectChar?: (id: string | null) => void;
  selectedLocId?: string | null;
  onSelectLoc?: (id: string | null) => void;
}

export default function BibleWorkspace({
  characters,
  locations,
  style,
  continuityList,
  chapters,
  activeChapterId,
  onUpdateCharacters,
  onUpdateLocations,
  onUpdateStyle,
  onUpdateContinuity,
  bibleTab: propBibleTab,
  onChangeBibleTab,
  selectedCharId: propSelectedCharId,
  onSelectChar,
  selectedLocId: propSelectedLocId,
  onSelectLoc,
}: BibleWorkspaceProps) {
  const { t } = useTranslation();
  const [localActiveTab, setLocalActiveTab] = useState<'characters' | 'locations' | 'style' | 'continuity'>('characters');

  // Active item selection
  const [localSelectedCharId, setLocalSelectedCharId] = useState<string | null>(null);
  const [localSelectedLocId, setLocalSelectedLocId] = useState<string | null>(null);

  const activeTab = propBibleTab !== undefined ? propBibleTab : localActiveTab;
  const setActiveTab = onChangeBibleTab !== undefined ? onChangeBibleTab : setLocalActiveTab;

  const selectedCharId = propSelectedCharId !== undefined ? propSelectedCharId : localSelectedCharId;
  const setSelectedCharId = onSelectChar !== undefined ? onSelectChar : setLocalSelectedCharId;

  const selectedLocId = propSelectedLocId !== undefined ? propSelectedLocId : localSelectedLocId;
  const setSelectedLocId = onSelectLoc !== undefined ? onSelectLoc : setLocalSelectedLocId;

  // Characters logic
  const handleAddChar = () => {
    const newChar: Character = {
      id: `char-${Date.now()}`,
      name: 'New Character',
      aliases: [],
      traits: [],
      desires: [],
      fears: [],
      relationships: [],
      evidence: [],
    };
    onUpdateCharacters([...characters.characters, newChar]);
    setSelectedCharId(newChar.id);
  };

  const handleUpdateChar = (updated: Character) => {
    onUpdateCharacters(characters.characters.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleDeleteChar = (id: string) => {
    onUpdateCharacters(characters.characters.filter((c) => c.id !== id));
    if (selectedCharId === id) setSelectedCharId(null);
  };

  // Locations logic
  const handleAddLoc = () => {
    const newLoc: Location = {
      id: `loc-${Date.now()}`,
      name: 'New Location',
      aliases: [],
      scale: 'room',
      descriptors: [],
      inhabitants: [],
      evidence: [],
    };
    onUpdateLocations([...locations.locations, newLoc]);
    setSelectedLocId(newLoc.id);
  };

  const handleUpdateLoc = (updated: Location) => {
    onUpdateLocations(locations.locations.map((l) => (l.id === updated.id ? updated : l)));
  };

  const handleDeleteLoc = (id: string) => {
    onUpdateLocations(locations.locations.filter((l) => l.id !== id));
    if (selectedLocId === id) setSelectedLocId(null);
  };

  // Previous Chapter Continuity Calculation
  const activeChapterIndex = chapters.findIndex((c) => c.id === activeChapterId);
  const prevChapter = activeChapterIndex > 0 ? chapters[activeChapterIndex - 1] : null;
  const prevContinuity = prevChapter ? continuityList[prevChapter.id] || '' : '';
  const currentContinuity = continuityList[activeChapterId] || '';

  const activeChar = characters.characters.find((c) => c.id === selectedCharId) || null;
  const activeLoc = locations.locations.find((l) => l.id === selectedLocId) || null;

  return (
    <div className="flex flex-col h-full bg-[var(--background)] select-none">
      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] bg-[var(--sidebar-bg)] overflow-x-auto">
        <button
          onClick={() => setActiveTab('characters')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-medium transition-all ${
            activeTab === 'characters'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--foreground)] opacity-70 hover:opacity-100'
          }`}
        >
          <Users size={16} />
          {t('characters')}
        </button>
        <button
          onClick={() => setActiveTab('locations')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-medium transition-all ${
            activeTab === 'locations'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--foreground)] opacity-70 hover:opacity-100'
          }`}
        >
          <MapPin size={16} />
          {t('locations')}
        </button>
        <button
          onClick={() => setActiveTab('style')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-medium transition-all ${
            activeTab === 'style'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--foreground)] opacity-70 hover:opacity-100'
          }`}
        >
          <Feather size={16} />
          {t('style')}
        </button>
        <button
          onClick={() => setActiveTab('continuity')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-medium transition-all ${
            activeTab === 'continuity'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--foreground)] opacity-70 hover:opacity-100'
          }`}
        >
          <Compass size={16} />
          {t('continuity')}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'characters' && (
          <>
            {/* Sidebar list */}
            <div className="w-64 border-r border-[var(--border)] bg-[var(--sidebar-bg)] flex flex-col">
              <div className="p-3 border-b border-[var(--border)] flex justify-between items-center">
                <span className="text-xs uppercase tracking-wider opacity-60 font-semibold">{t('characters')}</span>
                <button
                  onClick={handleAddChar}
                  className="p-1 rounded bg-[var(--accent)] text-white hover:opacity-90"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {characters.characters.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCharId(c.id)}
                    className={`p-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between ${
                      selectedCharId === c.id
                        ? 'bg-[var(--accent-light)] text-[var(--accent)] font-medium'
                        : 'hover:bg-[var(--border)] text-[var(--foreground)]'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChar(c.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* Details panel */}
            <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-[#1f1f1e]">
              {activeChar ? (
                <div className="max-w-2xl space-y-4">
                  <div className="flex justify-between items-center">
                    <input
                      type="text"
                      value={activeChar.name}
                      onChange={(e) => handleUpdateChar({ ...activeChar, name: e.target.value })}
                      className="text-2xl font-bold border-b border-transparent focus:border-[var(--accent)] focus:outline-none w-full bg-transparent text-[var(--foreground)] pb-1"
                    />
                    <button
                      onClick={() => handleDeleteChar(activeChar.id)}
                      className="text-red-500 hover:text-red-700 flex items-center gap-1 text-sm font-medium"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase opacity-75 mb-1">Aliases (comma separated)</label>
                      <input
                        type="text"
                        value={activeChar.aliases.join(', ')}
                        onChange={(e) =>
                          handleUpdateChar({
                            ...activeChar,
                            aliases: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase opacity-75 mb-1">Role / Archetype</label>
                      <input
                        type="text"
                        value={activeChar.role || ''}
                        onChange={(e) => handleUpdateChar({ ...activeChar, role: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                        placeholder="e.g. Protagonist"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase opacity-75 mb-1">Appearance Description</label>
                    <textarea
                      value={activeChar.appearance || ''}
                      onChange={(e) => handleUpdateChar({ ...activeChar, appearance: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      placeholder="Sensory descriptions..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase opacity-75 mb-1">Speech & Dialogue Habits</label>
                    <input
                      type="text"
                      value={activeChar.speechPatterns || ''}
                      onChange={(e) => handleUpdateChar({ ...activeChar, speechPatterns: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      placeholder="e.g. Formal tone, pauses often"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase opacity-75 mb-1">Traits, desires and fears</label>
                    <textarea
                      value={activeChar.notes || ''}
                      onChange={(e) => handleUpdateChar({ ...activeChar, notes: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      placeholder="Character notes, ambitions, background secrets..."
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm opacity-50 p-12">{t('noBibleEntries')}</div>
              )}
            </div>
          </>
        )}

        {activeTab === 'locations' && (
          <>
            {/* Sidebar list */}
            <div className="w-64 border-r border-[var(--border)] bg-[var(--sidebar-bg)] flex flex-col">
              <div className="p-3 border-b border-[var(--border)] flex justify-between items-center">
                <span className="text-xs uppercase tracking-wider opacity-60 font-semibold">{t('locations')}</span>
                <button
                  onClick={handleAddLoc}
                  className="p-1 rounded bg-[var(--accent)] text-white hover:opacity-90"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {locations.locations.map((l) => (
                  <div
                    key={l.id}
                    onClick={() => setSelectedLocId(l.id)}
                    className={`p-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-between ${
                      selectedLocId === l.id
                        ? 'bg-[var(--accent-light)] text-[var(--accent)] font-medium'
                        : 'hover:bg-[var(--border)] text-[var(--foreground)]'
                    }`}
                  >
                    <span className="truncate">{l.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLoc(l.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* Details panel */}
            <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-[#1f1f1e]">
              {activeLoc ? (
                <div className="max-w-2xl space-y-4">
                  <div className="flex justify-between items-center">
                    <input
                      type="text"
                      value={activeLoc.name}
                      onChange={(e) => handleUpdateLoc({ ...activeLoc, name: e.target.value })}
                      className="text-2xl font-bold border-b border-transparent focus:border-[var(--accent)] focus:outline-none w-full bg-transparent text-[var(--foreground)] pb-1"
                    />
                    <button
                      onClick={() => handleDeleteLoc(activeLoc.id)}
                      className="text-red-500 hover:text-red-700 flex items-center gap-1 text-sm font-medium"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase opacity-75 mb-1">Aliases (comma separated)</label>
                      <input
                        type="text"
                        value={activeLoc.aliases.join(', ')}
                        onChange={(e) =>
                          handleUpdateLoc({
                            ...activeLoc,
                            aliases: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase opacity-75 mb-1">Scale</label>
                      <select
                        value={activeLoc.scale}
                        onChange={(e) => handleUpdateLoc({ ...activeLoc, scale: e.target.value as 'room' | 'building' | 'district' | 'city' | 'region' | 'world' })}
                        className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      >
                        <option value="room">Room</option>
                        <option value="building">Building</option>
                        <option value="district">District</option>
                        <option value="city">City</option>
                        <option value="region">Region</option>
                        <option value="world">World</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase opacity-75 mb-1">Sensory Descriptors (comma separated)</label>
                    <input
                      type="text"
                      value={activeLoc.descriptors.join(', ')}
                      onChange={(e) =>
                        handleUpdateLoc({
                          ...activeLoc,
                          descriptors: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      placeholder="e.g. narrow, smells of fish sauce, quiet"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase opacity-75 mb-1">Narrative Significance & Notes</label>
                    <textarea
                      value={activeLoc.notes || ''}
                      onChange={(e) => handleUpdateLoc({ ...activeLoc, notes: e.target.value })}
                      rows={5}
                      className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      placeholder="Why does this place matter? Historical context, key event scenes..."
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm opacity-50 p-12">{t('noBibleEntries')}</div>
              )}
            </div>
          </>
        )}

        {activeTab === 'style' && (
          <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-[#1f1f1e]">
            <div className="max-w-2xl space-y-6">
              <h2 className="text-xl font-semibold border-b border-[var(--border)] pb-2">{t('style')}</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase opacity-75 mb-1">Point of view (POV)</label>
                  <select
                    value={style.narrativeRegister.pointOfView}
                    onChange={(e) =>
                      onUpdateStyle({
                        ...style,
                        narrativeRegister: { ...style.narrativeRegister, pointOfView: e.target.value as 'first' | 'second' | 'third-limited' | 'third-omniscient' },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="first">First Person</option>
                    <option value="second">Second Person</option>
                    <option value="third-limited">Third Person Limited</option>
                    <option value="third-omniscient">Third Person Omniscient</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase opacity-75 mb-1">Tense</label>
                  <select
                    value={style.narrativeRegister.tense}
                    onChange={(e) =>
                      onUpdateStyle({
                        ...style,
                        narrativeRegister: { ...style.narrativeRegister, tense: e.target.value as 'past' | 'present' },
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="past">Past Tense</option>
                    <option value="present">Present Tense</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase opacity-75 mb-1">Sentence / Rhythm Preferences</label>
                <input
                  type="text"
                  value={style.rhythm.avgSentenceLengthHint || ''}
                  onChange={(e) =>
                    onUpdateStyle({
                      ...style,
                      rhythm: { ...style.rhythm, avgSentenceLengthHint: e.target.value },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  placeholder="e.g. short, varied, lyrical"
                />
              </div>

              <div>
                <label className="block text-xs uppercase opacity-75 mb-1">Vocabulary Style (Favored words)</label>
                <input
                  type="text"
                  value={style.diction.register || ''}
                  onChange={(e) =>
                    onUpdateStyle({
                      ...style,
                      diction: { ...style.diction, register: e.target.value },
                    })
                  }
                  className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                  placeholder="e.g. literary contemporary, elegant"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'continuity' && (
          <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-[#1f1f1e] flex flex-col md:flex-row gap-6">
            {/* Prev chapter details */}
            <div className="flex-1 border border-[var(--border)] rounded-lg p-4 bg-[var(--sidebar-bg)] flex flex-col">
              <span className="text-xs uppercase opacity-70 font-semibold mb-2">
                Inherited from previous chapter
              </span>
              <textarea
                value={prevContinuity || 'No preceding chapter continuity.'}
                readOnly
                className="flex-1 bg-transparent text-[var(--foreground)] opacity-70 text-sm resize-none focus:outline-none leading-relaxed"
              />
            </div>

            {/* Current chapter details */}
            <div className="flex-1 border border-[var(--border)] rounded-lg p-4 flex flex-col bg-white dark:bg-[#191918]">
              <span className="text-xs uppercase opacity-70 font-semibold mb-2 text-[var(--accent)]">
                Established by active chapter
              </span>
              <textarea
                value={currentContinuity}
                onChange={(e) => onUpdateContinuity(activeChapterId, e.target.value)}
                placeholder="# Summary\n- Key event..."
                className="flex-1 bg-transparent text-[var(--foreground)] text-sm resize-none focus:outline-none leading-relaxed font-mono"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
