import React, { useState } from 'react';
import { Users, MapPin, Feather, Compass, Plus, Trash2, Box, Upload, Image } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { Character, Location, Item, Style } from '../storage/schemas';

interface BibleWorkspaceProps {
  characters: { schemaVersion: 1; characters: Character[] };
  locations: { schemaVersion: 1; locations: Location[] };
  items: { schemaVersion: 1; items: Item[] };
  style: Style;
  continuityList: Record<string, string>; // chapterId -> markdown
  chapters: { id: string; title: string }[];
  activeChapterId: string;
  onUpdateCharacters: (chars: Character[]) => void;
  onUpdateLocations: (locs: Location[]) => void;
  onUpdateItems: (items: Item[]) => void;
  onUpdateStyle: (style: Style) => void;
  onUpdateContinuity: (chapterId: string, content: string) => void;
  
  // Lifted selection states for story bible quick-nav
  bibleTab?: 'characters' | 'locations' | 'items' | 'style' | 'continuity';
  onChangeBibleTab?: (tab: 'characters' | 'locations' | 'items' | 'style' | 'continuity') => void;
  selectedCharId?: string | null;
  onSelectChar?: (id: string | null) => void;
  selectedLocId?: string | null;
  onSelectLoc?: (id: string | null) => void;
  selectedItemId?: string | null;
  onSelectItem?: (id: string | null) => void;
}

export default function BibleWorkspace({
  characters,
  locations,
  items,
  style,
  continuityList,
  chapters,
  activeChapterId,
  onUpdateCharacters,
  onUpdateLocations,
  onUpdateItems,
  onUpdateStyle,
  onUpdateContinuity,
  bibleTab: propBibleTab,
  onChangeBibleTab,
  selectedCharId: propSelectedCharId,
  onSelectChar,
  selectedLocId: propSelectedLocId,
  onSelectLoc,
  selectedItemId: propSelectedItemId,
  onSelectItem,
}: BibleWorkspaceProps) {
  const { t } = useTranslation();
  const [localActiveTab, setLocalActiveTab] = useState<'characters' | 'locations' | 'items' | 'style' | 'continuity'>('characters');

  // Active item selection
  const [localSelectedCharId, setLocalSelectedCharId] = useState<string | null>(null);
  const [localSelectedLocId, setLocalSelectedLocId] = useState<string | null>(null);
  const [localSelectedItemId, setLocalSelectedItemId] = useState<string | null>(null);

  const activeTab = propBibleTab !== undefined ? propBibleTab : localActiveTab;
  const setActiveTab = onChangeBibleTab !== undefined ? onChangeBibleTab : setLocalActiveTab;

  const selectedCharId = propSelectedCharId !== undefined ? propSelectedCharId : localSelectedCharId;
  const setSelectedCharId = onSelectChar !== undefined ? onSelectChar : setLocalSelectedCharId;

  const selectedLocId = propSelectedLocId !== undefined ? propSelectedLocId : localSelectedLocId;
  const setSelectedLocId = onSelectLoc !== undefined ? onSelectLoc : setLocalSelectedLocId;

  const selectedItemId = propSelectedItemId !== undefined ? propSelectedItemId : localSelectedItemId;
  const setSelectedItemId = onSelectItem !== undefined ? onSelectItem : setLocalSelectedItemId;

  const handleAvatarChange = <T extends object>(
    e: React.ChangeEvent<HTMLInputElement>,
    activeEntity: T,
    updateFn: (updated: T) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      updateFn({ ...activeEntity, avatar: reader.result as string } as T);
    };
    reader.readAsDataURL(file);
  };

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

  // Items logic
  const handleAddItem = () => {
    const newItem: Item = {
      id: `item-${Date.now()}`,
      name: 'New Item',
      aliases: [],
      description: '',
      significance: '',
      notes: '',
      evidence: [],
    };
    onUpdateItems([...items.items, newItem]);
    setSelectedItemId(newItem.id);
  };

  const handleUpdateItem = (updated: Item) => {
    onUpdateItems(items.items.map((i) => (i.id === updated.id ? updated : i)));
  };

  const handleDeleteItem = (id: string) => {
    onUpdateItems(items.items.filter((i) => i.id !== id));
    if (selectedItemId === id) setSelectedItemId(null);
  };

  // Previous Chapter Continuity Calculation
  const activeChapterIndex = chapters.findIndex((c) => c.id === activeChapterId);
  const prevChapter = activeChapterIndex > 0 ? chapters[activeChapterIndex - 1] : null;
  const prevContinuity = prevChapter ? continuityList[prevChapter.id] || '' : '';
  const currentContinuity = continuityList[activeChapterId] || '';

  const activeChar = characters.characters.find((c) => c.id === selectedCharId) || null;
  const activeLoc = locations.locations.find((l) => l.id === selectedLocId) || null;
  const activeItem = items.items.find((i) => i.id === selectedItemId) || null;

  return (
    <div className="flex flex-col h-full bg-[var(--background)] select-none">
      {/* Tabs */}
      <div data-tour="bible-type-switcher" className="flex border-b border-[var(--border)] bg-[var(--sidebar-bg)] overflow-x-auto">
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
          onClick={() => setActiveTab('items')}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-medium transition-all ${
            activeTab === 'items'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-[var(--foreground)] opacity-70 hover:opacity-100'
          }`}
        >
          <Box size={16} />
          {t('items')}
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
                  data-tour="bible-add"
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
                    className={`p-2 rounded-lg cursor-pointer transition-all flex items-center justify-between group gap-2 ${
                      selectedCharId === c.id
                        ? 'bg-[var(--accent-light)] text-[var(--accent)] font-medium'
                        : 'hover:bg-[var(--border)] text-[var(--foreground)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {c.avatar ? (
                        <img src={c.avatar} alt={c.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[var(--border)] flex items-center justify-center text-xs font-semibold shrink-0 text-[var(--foreground)] opacity-60">
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="truncate text-sm">{c.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChar(c.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 transition-opacity shrink-0"
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
                  <div className="flex items-start gap-4">
                    {/* Avatar Circle Preview with Hover File Selector */}
                    <div className="relative w-20 h-20 rounded-full overflow-hidden border border-[var(--border)] group/avatar bg-[var(--sidebar-bg)] shrink-0 flex items-center justify-center shadow-sm">
                      {activeChar.avatar ? (
                        <img src={activeChar.avatar} alt={activeChar.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-2xl font-bold opacity-30 select-none">
                          {activeChar.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-semibold text-center p-1">
                        <Upload size={14} className="mb-0.5" />
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleAvatarChange(e, activeChar, handleUpdateChar)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-center">
                        <input
                          type="text"
                          value={activeChar.name}
                          onChange={(e) => handleUpdateChar({ ...activeChar, name: e.target.value })}
                          className="text-2xl font-bold border-b border-transparent focus:border-[var(--accent)] focus:outline-none w-full bg-transparent text-[var(--foreground)] pb-1"
                        />
                        <button
                          onClick={() => handleDeleteChar(activeChar.id)}
                          className="text-red-500 hover:text-red-700 flex items-center gap-1 text-sm font-medium shrink-0 ml-2"
                        >
                          <Trash2 size={14} /> {t('delete')}
                        </button>
                      </div>

                      {activeChar.avatar && (
                        <button
                          type="button"
                          onClick={() => handleUpdateChar({ ...activeChar, avatar: undefined })}
                          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 w-fit"
                        >
                          <Trash2 size={12} /> Remove Avatar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs uppercase opacity-75 mb-1">{t('aliasesComma')}</label>
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
                      <label className="block text-xs uppercase opacity-75 mb-1">{t('roleArchetype')}</label>
                      <input
                        type="text"
                        value={activeChar.role || ''}
                        onChange={(e) => handleUpdateChar({ ...activeChar, role: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                        placeholder="e.g. Protagonist"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase opacity-75 mb-1">{t('highlightColor')}</label>
                      <div className="flex items-center gap-2">
                        <div className="relative w-8 h-8 rounded border border-[var(--border)] overflow-hidden shrink-0 shadow-sm bg-white dark:bg-zinc-800">
                          <input
                            type="color"
                            value={activeChar.color || '#a0aec0'}
                            onChange={(e) => handleUpdateChar({ ...activeChar, color: e.target.value })}
                            className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer scale-150"
                          />
                        </div>
                        <span className="text-xs font-mono opacity-80 uppercase">{activeChar.color || 'Default'}</span>
                        {activeChar.color && (
                          <button
                            type="button"
                            onClick={() => handleUpdateChar({ ...activeChar, color: undefined })}
                            className="text-xs text-[var(--accent)] hover:underline ml-1"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase opacity-75 mb-1">{t('appearanceDesc')}</label>
                    <textarea
                      value={activeChar.appearance || ''}
                      onChange={(e) => handleUpdateChar({ ...activeChar, appearance: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      placeholder="Sensory descriptions..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase opacity-75 mb-1">{t('speechHabits')}</label>
                    <input
                      type="text"
                      value={activeChar.speechPatterns || ''}
                      onChange={(e) => handleUpdateChar({ ...activeChar, speechPatterns: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      placeholder="e.g. Formal tone, pauses often"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase opacity-75 mb-1">{t('traitsDesiresFears')}</label>
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
                    className={`p-2 rounded-lg cursor-pointer transition-all flex items-center justify-between group gap-2 ${
                      selectedLocId === l.id
                        ? 'bg-[var(--accent-light)] text-[var(--accent)] font-medium'
                        : 'hover:bg-[var(--border)] text-[var(--foreground)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {l.avatar ? (
                        <img src={l.avatar} alt={l.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[var(--border)] flex items-center justify-center text-xs font-semibold shrink-0 text-[var(--foreground)] opacity-60">
                          {l.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="truncate text-sm">{l.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLoc(l.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 transition-opacity shrink-0"
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
                  <div className="flex items-start gap-4">
                    {/* Avatar Circle Preview with Hover File Selector */}
                    <div className="relative w-20 h-20 rounded-full overflow-hidden border border-[var(--border)] group/avatar bg-[var(--sidebar-bg)] shrink-0 flex items-center justify-center shadow-sm">
                      {activeLoc.avatar ? (
                        <img src={activeLoc.avatar} alt={activeLoc.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-2xl font-bold opacity-30 select-none">
                          {activeLoc.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-semibold text-center p-1">
                        <Upload size={14} className="mb-0.5" />
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleAvatarChange(e, activeLoc, handleUpdateLoc)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-center">
                        <input
                          type="text"
                          value={activeLoc.name}
                          onChange={(e) => handleUpdateLoc({ ...activeLoc, name: e.target.value })}
                          className="text-2xl font-bold border-b border-transparent focus:border-[var(--accent)] focus:outline-none w-full bg-transparent text-[var(--foreground)] pb-1"
                        />
                        <button
                          onClick={() => handleDeleteLoc(activeLoc.id)}
                          className="text-red-500 hover:text-red-700 flex items-center gap-1 text-sm font-medium shrink-0 ml-2"
                        >
                          <Trash2 size={14} /> {t('delete')}
                        </button>
                      </div>

                      {activeLoc.avatar && (
                        <button
                          type="button"
                          onClick={() => handleUpdateLoc({ ...activeLoc, avatar: undefined })}
                          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 w-fit"
                        >
                          <Trash2 size={12} /> Remove Avatar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs uppercase opacity-75 mb-1">{t('aliasesComma')}</label>
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
                      <label className="block text-xs uppercase opacity-75 mb-1">{t('scale')}</label>
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
                    <div>
                      <label className="block text-xs uppercase opacity-75 mb-1">{t('highlightColor')}</label>
                      <div className="flex items-center gap-2">
                        <div className="relative w-8 h-8 rounded border border-[var(--border)] overflow-hidden shrink-0 shadow-sm bg-white dark:bg-zinc-800">
                          <input
                            type="color"
                            value={activeLoc.color || '#a0aec0'}
                            onChange={(e) => handleUpdateLoc({ ...activeLoc, color: e.target.value })}
                            className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer scale-150"
                          />
                        </div>
                        <span className="text-xs font-mono opacity-80 uppercase">{activeLoc.color || 'Default'}</span>
                        {activeLoc.color && (
                          <button
                            type="button"
                            onClick={() => handleUpdateLoc({ ...activeLoc, color: undefined })}
                            className="text-xs text-[var(--accent)] hover:underline ml-1"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase opacity-75 mb-1">{t('sensoryDescriptors')}</label>
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
                    <label className="block text-xs uppercase opacity-75 mb-1">{t('narrativeSignificance')}</label>
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

        {activeTab === 'items' && (
          <>
            {/* Sidebar list */}
            <div className="w-64 border-r border-[var(--border)] bg-[var(--sidebar-bg)] flex flex-col">
              <div className="p-3 border-b border-[var(--border)] flex justify-between items-center">
                <span className="text-xs uppercase tracking-wider opacity-60 font-semibold">{t('items')}</span>
                <button
                  onClick={handleAddItem}
                  className="p-1 rounded bg-[var(--accent)] text-white hover:opacity-90"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {items.items.map((i) => (
                  <div
                    key={i.id}
                    onClick={() => setSelectedItemId(i.id)}
                    className={`p-2 rounded-lg cursor-pointer transition-all flex items-center justify-between group gap-2 ${
                      selectedItemId === i.id
                        ? 'bg-[var(--accent-light)] text-[var(--accent)] font-medium'
                        : 'hover:bg-[var(--border)] text-[var(--foreground)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {i.avatar ? (
                        <img src={i.avatar} alt={i.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[var(--border)] flex items-center justify-center text-xs font-semibold shrink-0 text-[var(--foreground)] opacity-60">
                          {i.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="truncate text-sm">{i.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(i.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 transition-opacity shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* Details panel */}
            <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-[#1f1f1e]">
              {activeItem ? (
                <div className="max-w-2xl space-y-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar Circle Preview with Hover File Selector */}
                    <div className="relative w-20 h-20 rounded-full overflow-hidden border border-[var(--border)] group/avatar bg-[var(--sidebar-bg)] shrink-0 flex items-center justify-center shadow-sm">
                      {activeItem.avatar ? (
                        <img src={activeItem.avatar} alt={activeItem.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-2xl font-bold opacity-30 select-none">
                          {activeItem.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-[10px] font-semibold text-center p-1">
                        <Upload size={14} className="mb-0.5" />
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleAvatarChange(e, activeItem, handleUpdateItem)}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-center">
                        <input
                          type="text"
                          value={activeItem.name}
                          onChange={(e) => handleUpdateItem({ ...activeItem, name: e.target.value })}
                          className="text-2xl font-bold border-b border-transparent focus:border-[var(--accent)] focus:outline-none w-full bg-transparent text-[var(--foreground)] pb-1"
                        />
                        <button
                          onClick={() => handleDeleteItem(activeItem.id)}
                          className="text-red-500 hover:text-red-700 flex items-center gap-1 text-sm font-medium shrink-0 ml-2"
                        >
                          <Trash2 size={14} /> {t('delete')}
                        </button>
                      </div>

                      {activeItem.avatar && (
                        <button
                          type="button"
                          onClick={() => handleUpdateItem({ ...activeItem, avatar: undefined })}
                          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 w-fit"
                        >
                          <Trash2 size={12} /> Remove Avatar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs uppercase opacity-75 mb-1">{t('aliasesComma')}</label>
                      <input
                        type="text"
                        value={activeItem.aliases.join(', ')}
                        onChange={(e) =>
                          handleUpdateItem({
                            ...activeItem,
                            aliases: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase opacity-75 mb-1">{t('highlightColor')}</label>
                      <div className="flex items-center gap-2">
                        <div className="relative w-8 h-8 rounded border border-[var(--border)] overflow-hidden shrink-0 shadow-sm bg-white dark:bg-zinc-800">
                          <input
                            type="color"
                            value={activeItem.color || '#a0aec0'}
                            onChange={(e) => handleUpdateItem({ ...activeItem, color: e.target.value })}
                            className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer scale-150"
                          />
                        </div>
                        <span className="text-xs font-mono opacity-80 uppercase">{activeItem.color || 'Default'}</span>
                        {activeItem.color && (
                          <button
                            type="button"
                            onClick={() => handleUpdateItem({ ...activeItem, color: undefined })}
                            className="text-xs text-[var(--accent)] hover:underline ml-1"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs uppercase opacity-75 mb-1">Description</label>
                    <textarea
                      value={activeItem.description || ''}
                      onChange={(e) => handleUpdateItem({ ...activeItem, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      placeholder="Describe the physical appearance, dimensions, or features..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase opacity-75 mb-1">Narrative Significance</label>
                    <textarea
                      value={activeItem.significance || ''}
                      onChange={(e) => handleUpdateItem({ ...activeItem, significance: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      placeholder="Why is this item important to the plot, characters, or lore?"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase opacity-75 mb-1">Notes</label>
                    <textarea
                      value={activeItem.notes || ''}
                      onChange={(e) => handleUpdateItem({ ...activeItem, notes: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                      placeholder="Additional notes..."
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm opacity-50 p-12">{t('noItemsYet')}</div>
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
                  <label className="block text-xs uppercase opacity-75 mb-1">{t('povLabel')}</label>
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
                    <option value="first">{t('firstPerson')}</option>
                    <option value="second">{t('secondPerson')}</option>
                    <option value="third-limited">{t('thirdLimited')}</option>
                    <option value="third-omniscient">{t('thirdOmniscient')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase opacity-75 mb-1">{t('tenseLabel')}</label>
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
                    <option value="past">{t('pastTense')}</option>
                    <option value="present">{t('presentTense')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase opacity-75 mb-1">{t('rhythmPrefs')}</label>
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
                <label className="block text-xs uppercase opacity-75 mb-1">{t('vocabularyStyle')}</label>
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
                {t('inheritedFromPrev')}
              </span>
              <textarea
                value={prevContinuity || t('noPrevContinuity')}
                readOnly
                className="flex-1 bg-transparent text-[var(--foreground)] opacity-70 text-sm resize-none focus:outline-none leading-relaxed"
              />
            </div>

            {/* Current chapter details */}
            <div className="flex-1 border border-[var(--border)] rounded-lg p-4 flex flex-col bg-white dark:bg-[#191918]">
              <span className="text-xs uppercase opacity-70 font-semibold mb-2 text-[var(--accent)]">
                {t('establishedByActive')}
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
