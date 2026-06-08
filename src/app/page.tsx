"use client";

import React, { useEffect, useState, useRef } from 'react';
import {
  Settings, History, Plus, FolderPlus, ArrowLeft, Download,
  Menu, MoreHorizontal, X as CloseIcon, BookOpen, Maximize2, Sparkles, MessageSquare
} from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { IndexedDBProjectStorage } from '../storage/IndexedDBProjectStorage';
import { ProjectStorage } from '../storage/ProjectStorage';
import { Project, Chapter, Character, Location, Item, Style, CharacterSchema, LocationSchema, ItemSchema, SnapshotIndex } from '../storage/schemas';
import { takeSnapshot } from '../storage/snapshots';
import { runTool, executeWriteOp } from '../ai/runTool';
import { makeCallModel } from '../ai/llm/client';
import { ToolContext, ToolResult, ProposalResult } from '../ai/types';
import ChapterList from '../editor/ChapterList';
import EditorCanvas, { EditorCanvasRef } from '../editor/EditorCanvas';
import BibleWorkspace from '../bible/BibleWorkspace';
import ExportImportDialog from '../ui/ExportImportDialog';
import SnapshotHistoryPanel from '../ui/SnapshotHistoryPanel';
import ConfirmDialog from '../ui/ConfirmDialog';
import OutlineGrid from '../ui/OutlineGrid';
import ProjectSettings from '../ui/ProjectSettings';
import CommandPalette from '../editor/CommandPalette';
import { WorkspaceAIConfig, loadAIConfig, saveAIConfig, DEFAULT_AI_CONFIG } from '../storage/aiConfig';
import AIPanel, { TranscriptTurn } from '../ui/AIPanel';
import SettingsView from '../ui/SettingsView';
import QuickCreateDialog, { isSmallSelection } from '../ui/QuickCreateDialog';
import SelectionAIToolbar from '../ui/SelectionAIToolbar';
import FlashPage from '../ui/FlashPage';
import { deriveSynopsis } from '../ai/continuity';
import RestoreDeletedChaptersDialog from '../ui/RestoreDeletedChaptersDialog';

export interface BeatData {
  type: 'action' | 'reaction' | 'dialogue' | 'realization' | 'decision' | 'transition';
  length: 200 | 400 | 600;
  intent: string;
  createdAt: string;
  mode?: 'write_beat' | 'continue';
}

const GithubIcon = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={`lucide lucide-github ${className}`}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
    <path d="M9 18c-4.51 2-5-2-7-2"/>
  </svg>
);

interface ProjectListItem {
  id: string;
  title: string;
  author: string;
  updatedAt: string;
  series?: string;
  seriesIndex?: number;
  coverImage?: string;
  archived?: boolean;
}

export default function WorkspacePage() {
  const { t } = useTranslation();
  const [storage, setStorage] = useState<ProjectStorage | null>(null);
  const [workspaceAI, setWorkspaceAI] = useState<WorkspaceAIConfig>(DEFAULT_AI_CONFIG);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [aiPanelSelectedActionId, setAiPanelSelectedActionId] = useState<string>('');
  const [hideSelectionToolbar, setHideSelectionToolbar] = useState(false);
  const [showAISettingsPage, setShowAISettingsPage] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'ai'>('general');
  const [showFlashPage, setShowFlashPage] = useState(false);

  // Dashboard state
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectList, setProjectList] = useState<ProjectListItem[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjAuthor, setNewProjAuthor] = useState('');

  // Workspace states
  const [project, setProject] = useState<Project | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapterMarkdown, setActiveChapterMarkdown] = useState<string>('');
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});

  // Bible states
  const [characters, setCharacters] = useState<{ schemaVersion: 1; characters: Character[] }>({
    schemaVersion: 1,
    characters: [],
  });
  const [locations, setLocations] = useState<{ schemaVersion: 1; locations: Location[] }>({
    schemaVersion: 1,
    locations: [],
  });
  const [items, setItems] = useState<{ schemaVersion: 1; items: Item[] }>({
    schemaVersion: 1,
    items: [],
  });

  // Lifted selection states for Story Bible quick-nav
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [bibleTab, setBibleTab] = useState<'characters' | 'locations' | 'items' | 'style' | 'continuity'>('characters');

  const [activeSelection, setActiveSelection] = useState<{
    from: number;
    to: number;
    text: string;
    textBefore: string;
    textAfter: string;
  } | null>(null);

  const selectionText = activeSelection?.text || '';
  useEffect(() => {
    setHideSelectionToolbar(false);
  }, [selectionText]);
  const editorRef = useRef<EditorCanvasRef>(null);
  const prevHistoryOpenRef = useRef(false);
  const prevAIPanelOpenRef = useRef(false);
  const [style, setStyle] = useState<Style>({
    schemaVersion: 1,
    rhythm: { avgSentenceLengthHint: '', paragraphLengthHint: '', rhythmNotes: '' },
    diction: { register: '', formality: 'neutral', favoredWords: [], avoidedWords: [] },
    dialogue: { taggingConvention: '', registerNotes: '', dialectMarkers: [] },
    narrativeRegister: { pointOfView: 'third-limited', tense: 'past', interiority: 'medium' },
    sensoryPalette: { dominantSenses: [], colorNotes: '', soundNotes: '' },
    pronounPairs: [],
  });
  const [continuityList, setContinuityList] = useState<Record<string, string>>({});
  const [chaptersWithHistory, setChaptersWithHistory] = useState<Set<string>>(new Set());
  const [aiTranscript, setAiTranscript] = useState<TranscriptTurn[]>([]);
  const [beats, setBeats] = useState<Record<string, BeatData>>({});
  const [activeBeatId, setActiveBeatId] = useState<string | null>(null);

  // Reset transcript when switching novels
  useEffect(() => {
    setAiTranscript([]);
  }, [project?.id]);

  const allSeries = React.useMemo(() => {
    const seriesSet = new Set<string>();
    projectList.forEach((p) => {
      if (p.series && p.series.trim()) {
        seriesSet.add(p.series.trim());
      }
    });
    return Array.from(seriesSet);
  }, [projectList]);

  // Layout states
  const [activeTab, setActiveTab] = useState<'editor' | 'outline' | 'bible' | 'settings'>('editor');
  const [isDistractionFree, setIsDistractionFree] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Mobile / tablet layout — see plan §7.7 (Slice 6, Mobile baseline).
  // - mobileView: on phones (<sm), 'chapters' replaces the main pane with a
  //   full-screen ChapterList; 'main' shows the active tab as normal.
  // - isMobileSidebarOpen: tablet slide-over (sm to <lg) for the sidebar.
  // - isMobileMoreOpen: the "More" bottom sheet on phone, exposing Outline /
  //   Bible / Settings / Snapshots / Export / Distraction-Free.
  const [mobileView, setMobileView] = useState<'main' | 'chapters'>('main');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  // Global Typography / Format preference state (remembered globally)
  const [globalTypography, setGlobalTypography] = useState<Project['typography']>({
    fontFamily: 'serif',
    fontSize: 'normal',
    lineHeight: 'comfortable',
    pageWidth: 'normal',
    textIndent: 'normal',
    chicagoStyle: false,
    paragraphSpacing: 'normal',
    textAlignment: 'left',
    sceneDivider: 'asterisk',
  });

  // Load global format, theme, and auto-snapshot interval from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedFormat = localStorage.getItem('xnovelist-global-format');
      if (savedFormat) {
        try {
          setGlobalTypography(JSON.parse(savedFormat));
        } catch {
          // ignore
        }
      }
      const savedTheme = localStorage.getItem('xnovelist-theme') as 'light' | 'dark';
      if (savedTheme) {
        setTheme(savedTheme);
      }
      const savedInterval = localStorage.getItem('xnovelist-snapshot-interval-min');
      if (savedInterval !== null) {
        setSnapshotIntervalMinutes(parseInt(savedInterval, 10));
      }
    }
  }, []);

  // Show flash page splash screen on first session load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const shown = sessionStorage.getItem('xnovelist_flash_shown');
      if (!shown) {
        setShowFlashPage(true);
      }
    }
  }, []);

  // Track active selection text for AI panel scope via EditorCanvas onSelectionChange.

  // Modal dialog toggles
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isRestoreDeletedOpen, setIsRestoreDeletedOpen] = useState(false);
  const [snapshotIntervalMinutes, setSnapshotIntervalMinutes] = useState<number>(30);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [projectDeleteId, setProjectDeleteId] = useState<string | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [jumpToSearchQuery, setJumpToSearchQuery] = useState<string | null>(null);

  // Initialize DB and load project registry
  useEffect(() => {
    const store = new IndexedDBProjectStorage();
    setStorage(store);

    const loadRegistry = async () => {
      const aiConfig = await loadAIConfig(store);
      setWorkspaceAI(aiConfig);

      let registryList: ProjectListItem[] = [];
      const exists = await store.exists('projects.json');
      if (exists) {
        const listStr = await store.readFile('projects.json');
        if (listStr) {
          try {
            registryList = JSON.parse(listStr);
            setProjectList(registryList);
          } catch {
            setProjectList([]);
          }
        }
      } else {
        // Seed first default sample project
        const sampleId = 'proj-masterpiece';
        const sampleList = [
          {
            id: sampleId,
            title: 'My Masterpiece',
            author: 'Anonymous',
            updatedAt: new Date().toISOString(),
          },
        ];
        await store.writeFile('projects.json', JSON.stringify(sampleList));
        setProjectList(sampleList);
        registryList = sampleList;

        // Seed project files
        const defaultProject: Project = {
          schemaVersion: 1,
          id: sampleId,
          title: 'My Masterpiece',
          author: 'Anonymous',
          genre: 'Fiction',
          pov: 'third-limited',
          tense: 'past',
          language: 'en',
          targetWordCount: 50000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          activeChapterId: 'chapter-1',
          chapterOrder: ['chapter-1'],
          typography: {
            fontFamily: 'serif',
            fontSize: 'normal',
            lineHeight: 'comfortable',
            pageWidth: 'normal',
            textIndent: 'normal',
            chicagoStyle: false,
            paragraphSpacing: 'normal',
            textAlignment: 'left',
            sceneDivider: 'asterisk',
          },
          archived: false,
          highlightBibleRefs: true,
          chapters: [],
        };

        const prefix = `projects/${sampleId}/`;
        await store.writeFile(`${prefix}Project.json`, JSON.stringify(defaultProject));
        await store.writeFile(`${prefix}Characters.json`, JSON.stringify({ schemaVersion: 1, characters: [] }));
        await store.writeFile(`${prefix}Locations.json`, JSON.stringify({ schemaVersion: 1, locations: [] }));
        await store.writeFile(`${prefix}Items.json`, JSON.stringify({ schemaVersion: 1, items: [] }));
        await store.writeFile(`${prefix}Style.json`, JSON.stringify({
          schemaVersion: 1,
          rhythm: { avgSentenceLengthHint: '', paragraphLengthHint: '', rhythmNotes: '' },
          diction: { register: '', formality: 'neutral', favoredWords: [], avoidedWords: [] },
          dialogue: { taggingConvention: '', registerNotes: '', dialectMarkers: [] },
          narrativeRegister: { pointOfView: 'third-limited', tense: 'past', interiority: 'medium' },
          sensoryPalette: { dominantSenses: [], colorNotes: '', soundNotes: '' },
          pronounPairs: [],
        }));
        await store.writeFile(`${prefix}Artifacts/chapter-chapter-1.md`, '# Chapter 1\n\nStart writing your novel here...');
      }

      // Check URL search params or localStorage for active project
      let targetProjId: string | null = null;
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlId = params.get('project');
        if (urlId) {
          targetProjId = urlId;
        } else {
          targetProjId = localStorage.getItem('xnovelist-active-project');
        }
      }

      if (targetProjId) {
        const projExists = registryList.some((p) => p.id === targetProjId);
        if (projExists) {
          await handleOpenProject(targetProjId, store);
        }
      }
    };

    loadRegistry();
    // handleOpenProject is intentionally omitted — this effect runs once on
    // mount to bootstrap the project registry and (if applicable) reopen the
    // last-active project. Including it would cause a re-bootstrap loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever the user picks a tab from the More menu (or anywhere), bring
  // them back to the "main" mobile view so the new tab is actually visible
  // on phone instead of hidden behind the full-screen chapter list.
  useEffect(() => {
    setMobileView('main');
  }, [activeTab]);

  // Global shortcut listeners (e.g. Cmd/Ctrl + P for Command Palette)
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      if (currentProjectId === null) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setActiveTab((prev) => (prev === 'outline' ? 'editor' : 'outline'));
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        if (workspaceAI.level >= 1) {
          e.preventDefault();
          setIsAIPanelOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [currentProjectId, workspaceAI]);


  // Load last used pen name when create modal is opened
  useEffect(() => {
    if (isCreateModalOpen && typeof window !== 'undefined') {
      const lastAuthor = localStorage.getItem('xnovelist-last-author') || '';
      setNewProjAuthor(lastAuthor);
    }
  }, [isCreateModalOpen]);

  // Global Escape handler: close the topmost dialog, otherwise exit
  // distraction-free mode. Plan §7.8 + §16 both require this.
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Don't steal Escape while the user is typing inline (e.g. chapter
      // rename); those inputs handle their own Escape and stop propagation.
      // We still get the event because we listen in the capture-less bubble
      // phase, so input handlers run first.
      if (deleteConfirmId !== null) { setDeleteConfirmId(null); return; }
      if (projectDeleteId !== null) { setProjectDeleteId(null); return; }
      if (isRestoreDeletedOpen) { setIsRestoreDeletedOpen(false); return; }
      if (isMobileMoreOpen) { setIsMobileMoreOpen(false); return; }
      if (isMobileSidebarOpen) { setIsMobileSidebarOpen(false); return; }
      if (isExportOpen) { setIsExportOpen(false); return; }
      if (isHistoryOpen) { setIsHistoryOpen(false); return; }
      if (isCreateModalOpen) { setIsCreateModalOpen(false); return; }
      if (isAIPanelOpen) { setIsAIPanelOpen(false); return; }
      if (showAISettingsPage) { setShowAISettingsPage(false); return; }
      if (isDistractionFree) { setIsDistractionFree(false); return; }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [
    deleteConfirmId,
    projectDeleteId,
    isRestoreDeletedOpen,
    isMobileMoreOpen,
    isMobileSidebarOpen,
    isExportOpen,
    isHistoryOpen,
    isCreateModalOpen,
    isAIPanelOpen,
    showAISettingsPage,
    isDistractionFree,
  ]);

  // Theme Syncing
  useEffect(() => {
    const bodyClass = document.body.classList;
    if (theme === 'dark') {
      bodyClass.add('dark-theme');
    } else {
      bodyClass.remove('dark-theme');
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('xnovelist-theme', theme);
    }
  }, [theme]);

  // Prevent both AIPanel and Snapshot History Panel from being open at the same time
  // If either panel is opened, close the other panel to avoid workspace cluttering.
  useEffect(() => {
    // If AIPanel was just opened, close History Panel
    if (isAIPanelOpen && !prevAIPanelOpenRef.current) {
      setIsHistoryOpen(false);
    }
    // If History Panel was just opened, close AIPanel
    else if (isHistoryOpen && !prevHistoryOpenRef.current) {
      setIsAIPanelOpen(false);
    }

    prevHistoryOpenRef.current = isHistoryOpen;
    prevAIPanelOpenRef.current = isAIPanelOpen;
  }, [isHistoryOpen, isAIPanelOpen]);

  // Interval snapshot — every N minutes of active writing the current
  // chapter is snapshotted to .history. Plan §7.6 calls for this.
  // takeSnapshot() de-dupes identical content via contentHash so an idle
  // tick does not bloat the history.
  useEffect(() => {
    if (!storage || !project?.activeChapterId || snapshotIntervalMinutes === 0) return;
    const intervalMs = snapshotIntervalMinutes * 60 * 1000;
    const id = window.setInterval(() => {
      takeSnapshot(storage, project.activeChapterId, 'interval', 'Auto interval snapshot', undefined, project.id)
        .catch(() => { /* ignore */ });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [storage, project?.id, project?.activeChapterId, snapshotIntervalMinutes]);

  // Load selected project data
  const handleOpenProject = async (projId: string, customStore?: ProjectStorage) => {
    const activeStore = customStore || storage;
    if (!activeStore) return;

    // Persist active project to localStorage and URL search query
    if (typeof window !== 'undefined') {
      localStorage.setItem('xnovelist-active-project', projId);
      const url = new URL(window.location.href);
      if (url.searchParams.get('project') !== projId) {
        url.searchParams.set('project', projId);
        window.history.replaceState({}, '', url.toString());
      }
    }

    setCurrentProjectId(projId);

    const prefix = `projects/${projId}/`;
    const projectStr = await activeStore.readFile(`${prefix}Project.json`);
    if (projectStr) {
      const loadedProj: Project = JSON.parse(projectStr);
      setProject(loadedProj);

      // Load chapters
      const paths = await activeStore.listFiles(`${prefix}Artifacts/chapter-`);
      const loadedChapters: Chapter[] = [];
      const wCounts: Record<string, number> = {};

      for (const p of paths) {
        const id = p.replace(`${prefix}Artifacts/chapter-`, '').replace('.md', '');
        const md = await activeStore.readFile(p) || '';
        const count = md.trim() === '' ? 0 : md.trim().split(/\s+/).length;
        wCounts[id] = count;

        const existingChap = (loadedProj.chapters || []).find((c: Chapter) => c.id === id);

        loadedChapters.push({
          id,
          title: md.split('\n')[0].replace('#', '').trim() || `Chapter ${id}`,
          createdAt: existingChap?.createdAt || new Date().toISOString(),
          updatedAt: existingChap?.updatedAt || new Date().toISOString(),
          synopsis: existingChap?.synopsis || '',
          status: existingChap?.status || 'draft',
        });
      }

      setChapters(loadedChapters);
      setWordCounts(wCounts);

      const activeMd = await activeStore.readFile(`${prefix}Artifacts/chapter-${loadedProj.activeChapterId}.md`) || '';
      setActiveChapterMarkdown(activeMd);

      // Scan for chapters with history
      const histPrefix = `${prefix}.history/Artifacts/`;
      const historyFiles = await activeStore.listFiles(histPrefix);
      const withHistory = new Set<string>();
      historyFiles.forEach(file => {
        const match = file.match(/\.history\/Artifacts\/chapter-([^/]+)\/index\.json$/);
        if (match) {
          withHistory.add(match[1]);
        }
      });
      setChaptersWithHistory(withHistory);
    }

    // Load Story Bible
    const charsStr = await activeStore.readFile(`${prefix}Characters.json`);
    if (charsStr) setCharacters(JSON.parse(charsStr));

    const locsStr = await activeStore.readFile(`${prefix}Locations.json`);
    if (locsStr) setLocations(JSON.parse(locsStr));

    const styleStr = await activeStore.readFile(`${prefix}Style.json`);
    if (styleStr) setStyle(JSON.parse(styleStr));

    let itemsData: { schemaVersion: 1; items: Item[] } = { schemaVersion: 1, items: [] };
    try {
      const itemsStr = await activeStore.readFile(`${prefix}Items.json`);
      if (itemsStr) itemsData = JSON.parse(itemsStr);
    } catch (e) {
      // ignore missing items file for legacy projects
    }
    setItems(itemsData);

    // Load continuity files
    const contPaths = await activeStore.listFiles(`${prefix}Continuity/`);
    const loadedContinuity: Record<string, string> = {};
    for (const p of contPaths) {
      const id = p.replace(`${prefix}Continuity/chapter-`, '').replace('.md', '');
      const content = await activeStore.readFile(p) || '';
      loadedContinuity[id] = content;
    }
    setContinuityList(loadedContinuity);

    // Load Beats sidecar
    let loadedBeats: Record<string, BeatData> = {};
    try {
      const beatsStr = await activeStore.readFile(`${prefix}Beats.json`);
      if (beatsStr) {
        loadedBeats = JSON.parse(beatsStr);
      }
    } catch (e) {
      // ignore
    }
    setBeats(loadedBeats);
    setActiveBeatId(null);

    // Sync beat params into ProseMirror node attrs after the editor has
    // finished loading the new chapter markdown (short delay lets Tiptap settle).
    if (Object.keys(loadedBeats).length > 0) {
      setTimeout(() => {
        if (!editorRef.current) return;
        for (const [beatId, data] of Object.entries(loadedBeats)) {
          editorRef.current.syncBeatAttrs(beatId, {
            beatType: data.type,
            beatMode: data.mode || 'write_beat',
            beatLength: data.length,
            beatIntent: data.intent,
          });
        }
      }, 150);
    }
  };

  // Create project handler
  const handleCreateProject = async () => {
    if (!storage || !newProjTitle.trim()) return;

    const projId = `proj-${Date.now()}`;
    const newProj: ProjectListItem = {
      id: projId,
      title: newProjTitle.trim(),
      author: newProjAuthor.trim() || 'Anonymous',
      updatedAt: new Date().toISOString(),
    };

    if (newProjAuthor.trim() && typeof window !== 'undefined') {
      localStorage.setItem('xnovelist-last-author', newProjAuthor.trim());
    }

    const updatedList = [...projectList, newProj];
    setProjectList(updatedList);
    await storage.writeFile('projects.json', JSON.stringify(updatedList));

    // Seed empty metadata files
    const defaultProject: Project = {
      schemaVersion: 1,
      id: projId,
      title: newProj.title,
      author: newProj.author,
      genre: 'Fiction',
      pov: 'third-limited',
      tense: 'past',
      language: 'en',
      targetWordCount: 50000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      activeChapterId: 'chapter-1',
      chapterOrder: ['chapter-1'],
      typography: {
        fontFamily: 'serif',
        fontSize: 'normal',
        lineHeight: 'comfortable',
        pageWidth: 'normal',
        textIndent: 'normal',
        chicagoStyle: false,
        paragraphSpacing: 'normal',
        textAlignment: 'left',
        sceneDivider: 'asterisk',
      },
      archived: false,
      highlightBibleRefs: true,
      chapters: [],
    };

    const prefix = `projects/${projId}/`;
    await storage.writeFile(`${prefix}Project.json`, JSON.stringify(defaultProject));
    await storage.writeFile(`${prefix}Characters.json`, JSON.stringify({ schemaVersion: 1, characters: [] }));
    await storage.writeFile(`${prefix}Locations.json`, JSON.stringify({ schemaVersion: 1, locations: [] }));
    await storage.writeFile(`${prefix}Items.json`, JSON.stringify({ schemaVersion: 1, items: [] }));
    await storage.writeFile(`${prefix}Style.json`, JSON.stringify({
      schemaVersion: 1,
      rhythm: { avgSentenceLengthHint: '', paragraphLengthHint: '', rhythmNotes: '' },
      diction: { register: '', formality: 'neutral', favoredWords: [], avoidedWords: [] },
      dialogue: { taggingConvention: '', registerNotes: '', dialectMarkers: [] },
      narrativeRegister: { pointOfView: 'third-limited', tense: 'past', interiority: 'medium' },
      sensoryPalette: { dominantSenses: [], colorNotes: '', soundNotes: '' },
      pronounPairs: [],
    }));
    await storage.writeFile(`${prefix}Artifacts/chapter-chapter-1.md`, '# Chapter 1\n\nStart writing your novel here...');

    // Reset create modal
    setNewProjTitle('');
    setNewProjAuthor('');
    setIsCreateModalOpen(false);

    // Open workspace immediately
    await handleOpenProject(projId);
  };

  // Delete project from registry
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleDeleteProject = async (id: string) => {
    setProjectDeleteId(id);
  };

  const confirmDeleteProject = async () => {
    if (!storage || !projectDeleteId) return;
    const id = projectDeleteId;

    const updatedList = projectList.filter((p) => p.id !== id);
    setProjectList(updatedList);
    await storage.writeFile('projects.json', JSON.stringify(updatedList));

    // Prune paths under `projects/${id}/`
    const files = await storage.listFiles(`projects/${id}/`);
    for (const file of files) {
      await storage.deleteFile(file).catch(() => { });
    }

    setProjectDeleteId(null);
  };

  // Close workspace and return to dashboard
  const handleBackToDashboard = async () => {
    if (!storage || !project) return;

    // Update registry list timestamp
    const updatedList = projectList.map((p) =>
      p.id === currentProjectId ? { ...p, updatedAt: new Date().toISOString() } : p
    );
    setProjectList(updatedList);
    await storage.writeFile('projects.json', JSON.stringify(updatedList));

    // Clear active project persistence
    if (typeof window !== 'undefined') {
      localStorage.removeItem('xnovelist-active-project');
      const url = new URL(window.location.href);
      url.searchParams.delete('project');
      window.history.replaceState({}, '', url.toString());
    }

    setCurrentProjectId(null);
    setProject(null);
  };

  // Active Chapter select handler
  const handleSelectChapter = async (id: string) => {
    if (!storage || !project) return;
    const prefix = `projects/${project.id}/`;
    const activeMd = await storage.readFile(`${prefix}Artifacts/chapter-${id}.md`) || '';
    setActiveChapterMarkdown(activeMd);

    const updated = { ...project, activeChapterId: id };
    setProject(updated);
    await storage.writeFile(`${prefix}Project.json`, JSON.stringify(updated));
  };

  // Create chapter handler
  const handleCreateChapter = async () => {
    if (!storage || !project) return;
    const prefix = `projects/${project.id}/`;

    const id = `chapter-${Date.now()}`;
    const newTitle = `Chapter ${chapters.length + 1}`;
    const newChapter: Chapter = {
      id,
      title: newTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      synopsis: '',
    };

    const newMarkdown = `# ${newTitle}\n\n`;
    await storage.writeFile(`${prefix}Artifacts/chapter-${id}.md`, newMarkdown);

    const updatedOrder = [...project.chapterOrder, id];
    const updatedProject = { ...project, activeChapterId: id, chapterOrder: updatedOrder };

    setChapters([...chapters, newChapter]);
    setWordCounts({ ...wordCounts, [id]: 2 });
    setProject(updatedProject);
    setActiveChapterMarkdown(newMarkdown);

    await storage.writeFile(`${prefix}Project.json`, JSON.stringify(updatedProject));
    await takeSnapshot(storage, id, 'manual', 'Chapter Created', newMarkdown, project.id);
  };

  const handleSaveAIConfig = async (newConfig: WorkspaceAIConfig) => {
    setWorkspaceAI(newConfig);
    if (storage) {
      await saveAIConfig(storage, newConfig);
    }
  };

  // Rename chapter handler
  const handleRenameChapter = async (id: string, newTitle: string) => {
    if (!storage || !project) return;
    const prefix = `projects/${project.id}/`;

    setChapters(chapters.map((c) => (c.id === id ? { ...c, title: newTitle } : c)));

    const filePath = `${prefix}Artifacts/chapter-${id}.md`;
    const content = await storage.readFile(filePath) || '';

    const lines = content.split('\n');
    lines[0] = `# ${newTitle}`;
    const updatedContent = lines.join('\n');

    await storage.writeFile(filePath, updatedContent);
    if (project.activeChapterId === id) {
      setActiveChapterMarkdown(updatedContent);
    }
  };

  // Delete chapter handler
  const handleDeleteChapter = async (id: string) => {
    setDeleteConfirmId(id);
  };
  const confirmDeleteChapter = async () => {
    if (!storage || !project || !deleteConfirmId) return;
    const prefix = `projects/${project.id}/`;
    const id = deleteConfirmId;
    const updatedChapters = chapters.filter((c) => c.id !== id);
    const updatedOrder = project.chapterOrder.filter((chId) => chId !== id);

    let activeId = project.activeChapterId;
    if (activeId === id) {
      activeId = updatedOrder[0] || '';
    }

    const updatedProject = { ...project, activeChapterId: activeId, chapterOrder: updatedOrder };

    // Pre-delete snapshot: capture the chapter's current content BEFORE removing it.
    // The chapter's `.history/Artifacts/chapter-${id}/` folder is deliberately NOT
    // deleted below, so this snapshot survives as a recoverable tombstone (Option A).
    try {
      await takeSnapshot(storage, id, 'pre-delete', 'Before delete', undefined, project.id);
    } catch {
      // best-effort; deletion proceeds even if the snapshot fails
    }

    setChapters(updatedChapters);
    setProject(updatedProject);
    setDeleteConfirmId(null);

    await storage.deleteFile(`${prefix}Artifacts/chapter-${id}.md`);
    // Note: `.history/Artifacts/chapter-${id}/` is intentionally preserved as a
    // tombstone so the chapter (incl. its pre-delete snapshot) can be recovered.
    await storage.writeFile(`${prefix}Project.json`, JSON.stringify(updatedProject));

    if (activeId) {
      const activeMd = await storage.readFile(`${prefix}Artifacts/chapter-${activeId}.md`) || '';
      setActiveChapterMarkdown(activeMd);
    } else {
      setActiveChapterMarkdown('');
    }
  };

  // Restore deleted chapter handler
  const handleRestoreDeletedChapter = async (id: string, title: string) => {
    if (!storage || !project) return;
    const prefix = `projects/${project.id}/`;

    // 1. Read last snapshot content
    const indexPath = `${prefix}.history/Artifacts/chapter-${id}/index.json`;
    if (!(await storage.exists(indexPath))) {
      throw new Error('No history index found for chapter to restore');
    }

    const indexStr = await storage.readFile(indexPath);
    if (!indexStr) throw new Error('No history index found for chapter to restore');
    const indexData: SnapshotIndex = JSON.parse(indexStr);
    const snaps = indexData.snapshots || [];
    if (snaps.length === 0) throw new Error('No snapshots found for chapter to restore');

    // Sort by createdAt descending to get the most recent snapshot
    const sortedSnaps = [...snaps].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const lastSnap = sortedSnaps[0];

    const snapPath = `${prefix}.history/Artifacts/chapter-${id}/${lastSnap.id}.md`;
    const markdown = await storage.readFile(snapPath) || '';

    // 2. Re-write the active chapter file
    const contentPath = `${prefix}Artifacts/chapter-${id}.md`;
    await storage.writeFile(contentPath, markdown);

    // 3. Update project metadata
    const restoredChapter: Chapter = {
      id,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synopsis: '',
      status: 'draft',
    };

    const existingChapters = project.chapters || [];
    const updatedChapters = existingChapters.some((c) => c.id === id)
      ? existingChapters.map((c) => c.id === id ? { ...c, updatedAt: new Date().toISOString() } : c)
      : [...existingChapters, restoredChapter];

    const updatedOrder = project.chapterOrder.includes(id)
      ? project.chapterOrder
      : [...project.chapterOrder, id];

    const updatedProject = {
      ...project,
      activeChapterId: id,
      chapters: updatedChapters,
      chapterOrder: updatedOrder,
    };

    // Update Project.json file
    await storage.writeFile(`${prefix}Project.json`, JSON.stringify(updatedProject));

    // Reload all project state from Project.json
    await handleOpenProject(project.id, storage);
  };

  // Reorder chapters handler
  const handleReorderChapters = async (newOrder: string[]) => {
    if (!storage || !project) return;
    const prefix = `projects/${project.id}/`;

    const updated = { ...project, chapterOrder: newOrder };
    setProject(updated);
    await storage.writeFile(`${prefix}Project.json`, JSON.stringify(updated));
  };

  const handleInsertBeat = async (
    chapterId: string,
    beatId: string,
    text: string,
    beatParams?: {
      mode?: 'write_beat' | 'continue';
      type?: string;
      length?: number;
      intent?: string;
    }
  ) => {
    if (!project || !storage) return;
    const prefix = `projects/${project.id}/`;

    if (editorRef.current) {
      // Pass beat params as node attrs so the header re-renders immediately
      // in the same transaction — no React state timing delay.
      const beatAttrs = beatParams ? {
        beatMode: beatParams.mode,
        beatType: beatParams.type,
        beatLength: beatParams.length,
        beatIntent: beatParams.intent,
      } : undefined;
      const applied = editorRef.current.applyBeat(beatId, text, beatAttrs);
      if (!applied) return;
    }

    setBeats((prev) => {
      const existing: BeatData = prev[beatId] || {
        type: 'action' as const,
        length: 400 as const,
        intent: '',
        createdAt: new Date().toISOString(),
      };
      const merged: BeatData = {
        ...existing,
        ...(beatParams?.type !== undefined && { type: beatParams.type as BeatData['type'] }),
        ...(beatParams?.length !== undefined && { length: beatParams.length as BeatData['length'] }),
        ...(beatParams?.intent !== undefined && { intent: beatParams.intent }),
        ...(beatParams?.mode !== undefined && { mode: beatParams.mode }),
      };
      const updated = { ...prev, [beatId]: merged };
      storage.writeFile(`${prefix}Beats.json`, JSON.stringify(updated));
      return updated;
    });
  };

  const getBeatData = (beatId: string) => {
    return beats[beatId] || null;
  };

  const handleUpdateBeatData = (beatId: string, data: Partial<{ type: string; length: number; intent: string; mode?: 'write_beat' | 'continue' }>) => {
    if (!project || !storage) return;
    const prefix = `projects/${project.id}/`;
    setBeats((prev) => {
      const existing = prev[beatId] || {
        type: 'action',
        length: 400,
        intent: '',
        createdAt: new Date().toISOString(),
      };
      const merged = {
        ...existing,
        ...data,
        type: (data.type || existing.type) as any,
        length: (data.length ? Number(data.length) : existing.length) as any,
        intent: data.intent !== undefined ? data.intent : existing.intent,
        mode: data.mode !== undefined ? data.mode : existing.mode,
      };
      const updated = {
        ...prev,
        [beatId]: merged,
      };
      storage.writeFile(`${prefix}Beats.json`, JSON.stringify(updated));
      return updated;
    });
  };

  // Editor prose save handler — writes to the chapter that initiated the save
  // (not necessarily the currently-active one, in case the user switched
  // chapters before the debounce fired).
  const handleSaveChapterMarkdown = async (markdown: string, count: number, chapterId: string) => {
    if (!storage || !project || !chapterId) return;
    const prefix = `projects/${project.id}/`;

    const filePath = `${prefix}Artifacts/chapter-${chapterId}.md`;
    await storage.writeFile(filePath, markdown);

    setWordCounts((prev) => ({ ...prev, [chapterId]: count }));

    // Garbage Collect Beats sidecar: scans all chapter markdowns and prunes Beats.json
    try {
      const beatIdsInUse = new Set<string>();

      // 1. Extract from the newly saved markdown (since it might not be written to disk/indexed yet by listFiles)
      const tokenRegex = /:::beat\{([^}]+)\}/g;
      let match;
      while ((match = tokenRegex.exec(markdown)) !== null) {
        beatIdsInUse.add(match[1]);
      }

      // 2. Extract from other chapters
      const paths = await storage.listFiles(`${prefix}Artifacts/chapter-`);
      for (const p of paths) {
        const cid = p.replace(`${prefix}Artifacts/chapter-`, '').replace('.md', '');
        if (cid === chapterId) continue;
        const md = await storage.readFile(p) || '';
        let m;
        tokenRegex.lastIndex = 0;
        while ((m = tokenRegex.exec(md)) !== null) {
          beatIdsInUse.add(m[1]);
        }
      }

      // 3. Filter current beats state
      setBeats((prev) => {
        const cleaned: Record<string, BeatData> = {};
        let changed = false;
        for (const [id, data] of Object.entries(prev)) {
          if (beatIdsInUse.has(id)) {
            cleaned[id] = data;
          } else {
            changed = true;
          }
        }
        if (changed) {
          storage.writeFile(`${prefix}Beats.json`, JSON.stringify(cleaned));
          return cleaned;
        }
        return prev;
      });
    } catch (gcErr) {
      console.error('GC beats failed:', gcErr);
    }
  };

  // Immediate (per-keystroke) word-count tracker. Keeps the project header
  // total and chapter list counts in sync with what's actually in the editor,
  // without waiting for the debounced storage save.
  const handleWordCountUpdate = (chapterId: string, count: number) => {
    if (!chapterId) return;
    setWordCounts((prev) => (prev[chapterId] === count ? prev : { ...prev, [chapterId]: count }));
  };

  // Manual snapshot trigger — fired by Cmd/Ctrl+S after the save, and used by
  // the "Snapshot now" button inside the history dialog.
  const handleManualSnapshot = async (chapterId: string) => {
    if (!storage || !project || !chapterId) return;
    await takeSnapshot(storage, chapterId, 'manual', 'Manual save snapshot', undefined, project.id)
      .catch(() => { /* ignore */ });
  };

  // Project properties update handler
  const handleUpdateProject = async (updated: Partial<Project>) => {
    if (!storage || !project) return;
    const prefix = `projects/${project.id}/`;

    const updatedProject = { ...project, ...updated } as Project;
    setProject(updatedProject);
    await storage.writeFile(`${prefix}Project.json`, JSON.stringify(updatedProject));

    if (updated.author !== undefined && updated.author.trim() && typeof window !== 'undefined') {
      localStorage.setItem('xnovelist-last-author', updated.author.trim());
    }

    // Also update project list registry for dashboard previews
    const updatedList = projectList.map((p) =>
      p.id === project.id
        ? {
            ...p,
            title: updated.title !== undefined ? updated.title : p.title,
            author: updated.author !== undefined ? updated.author : p.author,
            series: updated.series !== undefined ? updated.series : p.series,
            seriesIndex: updated.seriesIndex !== undefined ? updated.seriesIndex : p.seriesIndex,
            coverImage: updated.coverImage !== undefined ? updated.coverImage : p.coverImage,
            archived: updated.archived !== undefined ? updated.archived : p.archived,
            updatedAt: new Date().toISOString(),
          }
        : p
    );
    setProjectList(updatedList);
    await storage.writeFile('projects.json', JSON.stringify(updatedList));
  };

  const handleUpdateChapterStatus = async (chapterId: string, status: Chapter['status']) => {
    if (!storage || !project) return;
    const prefix = `projects/${project.id}/`;
    
    const updatedChapters = chapters.map(c => c.id === chapterId ? { ...c, status } : c);
    setChapters(updatedChapters);

    const updatedProj = { ...project, chapters: updatedChapters };
    setProject(updatedProj);
    await storage.writeFile(`${prefix}Project.json`, JSON.stringify(updatedProj));
  };

  const handleArchiveProject = async (archived: boolean) => {
    if (!storage || !project) return;
    const prefix = `projects/${project.id}/`;
    
    const updatedProj = { ...project, archived };
    setProject(updatedProj);
    await storage.writeFile(`${prefix}Project.json`, JSON.stringify(updatedProj));
    
    const updatedList = projectList.map(p => p.id === project.id ? { ...p, archived } : p);
    setProjectList(updatedList);
    await storage.writeFile('projects.json', JSON.stringify(updatedList));
    
    handleBackToDashboard();
  };

  const handleDeleteActiveProject = async () => {
    if (!storage || !project) return;
    const prefix = `projects/${project.id}/`;
    
    const allFiles = await storage.listFiles(prefix);
    for (const f of allFiles) {
      await storage.deleteFile(f);
    }
    
    const updatedList = projectList.filter(p => p.id !== project.id);
    setProjectList(updatedList);
    await storage.writeFile('projects.json', JSON.stringify(updatedList));
    
    handleBackToDashboard();
  };

  // Full-text manuscript fuzzy search for command palette
  const handleSearchManuscript = async (
    query: string
  ): Promise<{ chapterId: string; chapterTitle: string; snippet: string }[]> => {
    if (!storage || !project || !query.trim()) return [];
    const prefix = `projects/${project.id}/`;
    const results: { chapterId: string; chapterTitle: string; snippet: string }[] = [];

    const paths = await storage.listFiles(`${prefix}Artifacts/chapter-`);
    for (const p of paths) {
      const id = p.replace(`${prefix}Artifacts/chapter-`, '').replace('.md', '');
      const md = await storage.readFile(p) || '';
      const chap = chapters.find((c) => c.id === id);
      const title = chap?.title || `Chapter ${id}`;

      const lowerMd = md.toLowerCase();
      const lowerQuery = query.toLowerCase();
      let index = lowerMd.indexOf(lowerQuery);
      
      while (index !== -1) {
        const start = Math.max(0, index - 40);
        const end = Math.min(md.length, index + query.length + 40);
        let snippet = md.slice(start, end).replace(/\n/g, ' ');
        if (start > 0) snippet = '...' + snippet;
        if (end < md.length) snippet = snippet + '...';

        results.push({
          chapterId: id,
          chapterTitle: title,
          snippet,
        });

        if (results.length >= 50) break;
        index = lowerMd.indexOf(lowerQuery, index + 1);
      }
      if (results.length >= 50) break;
    }
    return results;
  };

  // Attach selected text as evidence to a story bible character, location, or item
  const handleAttachEvidence = async (
    entityType: 'characters' | 'locations' | 'items',
    entityId: string,
    quote: string
  ) => {
    if (!storage || !project) return;
    const prefix = `projects/${project.id}/`;
    const timestamp = Date.now();
    const newEvidence = {
      chapterId: project.activeChapterId,
      quote,
      addedAt: timestamp,
    };

    if (entityType === 'characters') {
      const updatedChars = characters.characters.map((char) => {
        if (char.id === entityId) {
          return {
            ...char,
            evidence: [...(char.evidence || []), newEvidence],
          };
        }
        return char;
      });
      setCharacters({ schemaVersion: 1, characters: updatedChars });
      await storage.writeFile(`${prefix}Characters.json`, JSON.stringify({ schemaVersion: 1, characters: updatedChars }));
    } else if (entityType === 'locations') {
      const updatedLocs = locations.locations.map((loc) => {
        if (loc.id === entityId) {
          return {
            ...loc,
            evidence: [...(loc.evidence || []), newEvidence],
          };
        }
        return loc;
      });
      setLocations({ schemaVersion: 1, locations: updatedLocs });
      await storage.writeFile(`${prefix}Locations.json`, JSON.stringify({ schemaVersion: 1, locations: updatedLocs }));
    } else if (entityType === 'items') {
      const updatedItems = items.items.map((item) => {
        if (item.id === entityId) {
          return {
            ...item,
            evidence: [...(item.evidence || []), newEvidence],
          };
        }
        return item;
      });
      setItems({ schemaVersion: 1, items: updatedItems });
      await storage.writeFile(`${prefix}Items.json`, JSON.stringify({ schemaVersion: 1, items: updatedItems }));
    }
  };

  // Typography settings modifier (Global Preference per request)
  const handleChangeTypography = (settings: Partial<Project['typography']>) => {
    setGlobalTypography((prev) => {
      const updated = { ...prev, ...settings } as Project['typography'];
      localStorage.setItem('xnovelist-global-format', JSON.stringify(updated));
      return updated;
    });
  };

  // Continuity document tracker
  const handleUpdateContinuity = async (chapterId: string, content: string) => {
    if (!storage || !project) return;
    const prefix = `projects/${project.id}/`;

    setContinuityList((prev) => ({ ...prev, [chapterId]: content }));
    await storage.writeFile(`${prefix}Continuity/chapter-${chapterId}.md`, content);

    // Derive the synopsis cache from the continuity document
    const synopsis = deriveSynopsis(content);
    const updatedChapters = chapters.map((c) => (c.id === chapterId ? { ...c, synopsis } : c));
    setChapters(updatedChapters);

    const updatedProj = { ...project, chapters: updatedChapters };
    setProject(updatedProj);
    await storage.writeFile(`${prefix}Project.json`, JSON.stringify(updatedProj));
  };

  // ---- AI engine wiring (Level 1) ----------------------------------------
  const buildToolContext = (modelOverride?: { providerId?: string; model?: string }): ToolContext => {
    if (!storage || !project) throw new Error('No active project.');
    const debug = { reasoning: '', raw: '' };
    return {
      storage,
      project: {
        ...project,
        chapters,
      },
      prefix: `projects/${project.id}/`,
      lang: project.language || 'en',
      debug,
      callModel: makeCallModel(workspaceAI, true, modelOverride, debug),
      chapterOrder: project.chapterOrder || [],
      onUpdateCharacters: (list) => {
        setCharacters({ schemaVersion: 1, characters: list });
      },
      onUpdateLocations: (list) => {
        setLocations({ schemaVersion: 1, locations: list });
      },
      onUpdateStyle: (newStyle) => {
        setStyle(newStyle);
      },
      onUpdateContinuity: async (chapterId, content) => {
        await handleUpdateContinuity(chapterId, content);
      },
      onReplaceRange: async (chapterId, from, to, text, expected) => {
        if (chapterId !== project.activeChapterId) {
          alert("Cannot apply edit: you have switched chapters since this suggestion was made.");
          return;
        }
        if (editorRef.current) {
          editorRef.current.replaceRange(from, to, text, expected);
        }
      },
      onInsertBeat: async (chapterId, beatId, text, beatParams) => {
        await handleInsertBeat(chapterId, beatId, text, beatParams);
      },
    };
  };

  const handleRunTool = async (
    toolId: string,
    input: unknown,
    modelOverride?: { providerId?: string; model?: string }
  ): Promise<ToolResult<ProposalResult>> => {
    if (!storage || !project) throw new Error('Open a project first.');
    return runTool(toolId, input, buildToolContext(modelOverride), workspaceAI);
  };

  const handleExecuteWriteOp = async (opId: string, args: unknown): Promise<void> => {
    if (!storage || !project) throw new Error('Open a project first.');
    await executeWriteOp(opId, args, buildToolContext(), workspaceAI);
  };

  if (showFlashPage) {
    return (
      <FlashPage
        onDismiss={() => {
          sessionStorage.setItem('xnovelist_flash_shown', 'true');
          setShowFlashPage(false);
        }}
      />
    );
  }

  if (!storage) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <span className="text-sm font-medium tracking-wide animate-pulse">{t('loading')}</span>
      </div>
    );
  }

  // Unified Settings Full Page View
  if (showAISettingsPage) {
    return (
      <SettingsView
        workspaceAI={workspaceAI}
        onChangeAIConfig={handleSaveAIConfig}
        theme={theme}
        onChangeTheme={setTheme}
        onBack={() => setShowAISettingsPage(false)}
        backLabel={currentProjectId ? "Back to Novel" : "Back to Novels Dashboard"}
        defaultTab={settingsTab}
        snapshotIntervalMinutes={snapshotIntervalMinutes}
        onChangeSnapshotInterval={(min) => {
          setSnapshotIntervalMinutes(min);
          localStorage.setItem('xnovelist-snapshot-interval-min', String(min));
        }}
      />
    );
  }

  // RENDER DASHBOARD
  if (currentProjectId === null) {
    return (
      <div className="h-screen w-screen flex flex-col overflow-y-auto bg-[var(--background)] p-6 md:p-12 text-[var(--foreground)] select-none">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          {/* Dashboard Header */}
          <div className="flex justify-between items-center pb-6 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <img src="logo.png" alt="logo" className="h-10 w-10 object-contain" />
              <div>
                <h1 className="text-2xl font-bold tracking-wider">XNOVELIST</h1>
                <p className="text-xs opacity-70">{t('appNameSub')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* GitHub Link Badge */}
              <a
                href="https://github.com/giapnguyen74/xnovelist"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--border)]/30 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition-all text-[10px] font-mono cursor-pointer border border-[var(--border)]/50 hover:border-[var(--accent)]/20"
              >
                <GithubIcon size={11} className="opacity-80" />
                <span>giapnguyen74/xnovelist</span>
              </a>

              {/* Feedback Link Badge */}
              <a
                href="https://forms.gle/42RaT4ZCjLJreTsG7"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all text-xs font-semibold cursor-pointer border border-[var(--accent)]/25 hover:border-transparent"
                title={t('giveFeedback')}
              >
                <MessageSquare size={13} className="text-current" />
                <span>{t('feedback')}</span>
              </a>

              {/* Theme toggler */}
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--sidebar-bg)] transition-colors text-xs font-semibold"
              >
                {theme === 'light' ? t('darkMode') : t('lightMode')}
              </button>

              {/* General Settings */}
              <button
                onClick={() => { setShowAISettingsPage(true); setSettingsTab('general'); }}
                className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--sidebar-bg)] transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-[var(--foreground)]"
              >
                <Settings size={14} className="opacity-80" />
                <span>{t('generalSettings')}</span>
              </button>

              {/* AI Settings */}
              <button
                onClick={() => { setShowAISettingsPage(true); setSettingsTab('ai'); }}
                className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--sidebar-bg)] transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-[var(--foreground)]"
              >
                <Sparkles size={14} className="opacity-80 text-[var(--accent)] animate-pulse" />
                <span>{t('aiSettings')}</span>
              </button>
            </div>
          </div>

          {/* Grid Layout of cards */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold uppercase tracking-wider opacity-85">{t('yourNovels')}</h2>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white hover:opacity-90 font-semibold rounded-lg text-xs transition-opacity shadow-sm"
              >
                <Plus size={16} />
                {t('createNewNovel')}
              </button>
            </div>

            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-x-5 gap-y-8">
              {/* Novel cards */}
              {projectList.filter(p => !p.archived).map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleOpenProject(p.id)}
                  className="group relative cursor-pointer flex flex-col transition-all"
                >
                  {/* Book Cover */}
                  <div className="relative w-full aspect-[3/4] rounded-none overflow-hidden border border-[var(--border)] shadow-sm bg-[#fbfbfa]">
                    {p.coverImage ? (
                      <img src={p.coverImage} alt="Cover" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />
                    ) : (
                      <img src="cover1.svg" alt="Cover" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />
                    )}
                  </div>

                  {/* Metadata under cover */}
                  <div className="mt-3 space-y-1">
                    <h3 className="font-serif font-bold text-sm text-[var(--foreground)] leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2 select-none">
                      {p.title}
                    </h3>
                    {p.series && (
                      <p className="text-[10px] font-semibold text-[var(--accent)] select-none">
                        {p.series} {p.seriesIndex !== undefined ? `#${p.seriesIndex}` : ''}
                      </p>
                    )}
                    <p className="text-[11px] opacity-60 select-none">
                      {new Date(p.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Create Card placeholder */}
              <div
                onClick={() => setIsCreateModalOpen(true)}
                className="group cursor-pointer flex flex-col"
              >
                <div className="w-full aspect-[3/4] rounded-none border-2 border-dashed border-[var(--border)] bg-[var(--editor-bg)] flex flex-col items-center justify-center p-4 opacity-70 group-hover:opacity-100 group-hover:border-[var(--accent)] group-hover:bg-emerald-600/5 transition-all shadow-sm">
                  <FolderPlus size={24} className="text-[var(--accent)] mb-2" />
                  <span className="text-xs font-semibold text-center leading-tight">{t('startNewNovel')}</span>
                </div>
                <div className="mt-3 space-y-1 opacity-60">
                  <h3 className="font-serif font-bold text-sm leading-snug truncate">{t('createNewNovel')}</h3>
                  <p className="text-[11px]">&nbsp;</p>
                </div>
              </div>
            </div>

            {/* Archived Novels collapsed group */}
            {projectList.filter(p => p.archived).length > 0 && (
              <div className="mt-12 pt-6 border-t border-[var(--border)] select-none">
                <details className="group/archived">
                  <summary className="text-xs font-bold uppercase tracking-wider opacity-60 hover:opacity-100 transition-opacity cursor-pointer list-none flex items-center gap-1.5 w-fit">
                    <span>{t('archivedNovels')} ({projectList.filter(p => p.archived).length})</span>
                    <span className="text-[9px] group-open/archived:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-x-5 gap-y-8 mt-6">
                    {projectList.filter(p => p.archived).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleOpenProject(p.id)}
                        className="group relative cursor-pointer flex flex-col transition-all opacity-60 hover:opacity-100"
                      >
                        <div className="relative w-full aspect-[3/4] rounded-none overflow-hidden border border-[var(--border)] shadow-sm bg-[#fbfbfa]">
                          {p.coverImage ? (
                            <img src={p.coverImage} alt="Cover" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />
                          ) : (
                            <img src="cover1.svg" alt="Cover" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />
                          )}
                        </div>
                        <div className="mt-3 space-y-1">
                          <h3 className="font-serif font-bold text-sm text-[var(--foreground)] leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2 select-none">
                            {p.title}
                          </h3>
                          {p.series && (
                            <p className="text-[10px] font-semibold text-[var(--accent)] select-none">
                              {p.series} {p.seriesIndex !== undefined ? `#${p.seriesIndex}` : ''}
                            </p>
                          )}
                          <p className="text-[11px] opacity-60 select-none">
                            {t('archived')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>

        {/* Create Project Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 animate-fade-in select-none">
            <div className="bg-white dark:bg-[#1e1e1d] border border-[var(--border)] rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4">
              <h3 className="text-base font-semibold text-[var(--foreground)] pb-2 border-b border-[var(--border)]">
                {t('createNewNovel')}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs uppercase opacity-75 mb-1">{t('title')}</label>
                  <input
                    type="text"
                    value={newProjTitle}
                    onChange={(e) => setNewProjTitle(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                    placeholder="e.g. Flight of the Quill"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase opacity-75 mb-1">{t('author')}</label>
                  <input
                    type="text"
                    value={newProjAuthor}
                    onChange={(e) => setNewProjAuthor(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md border border-[var(--border)] bg-transparent text-[var(--foreground)] text-sm focus:outline-none focus:border-[var(--accent)]"
                    placeholder="Anonymous"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-md hover:bg-[var(--border)] text-[var(--foreground)]"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjTitle.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {t('create')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Project Confirmation */}
        <ConfirmDialog
          isOpen={projectDeleteId !== null}
          title={t('deleteNovelTitle')}
          message={t('deleteNovelMsg')}
          onConfirm={confirmDeleteProject}
          onCancel={() => setProjectDeleteId(null)}
        />


      </div>
    );
  }

  // Loading project safety guard
  if (!project) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <span className="text-sm font-medium tracking-wide animate-pulse">{t('loading')}</span>
      </div>
    );
  }

  // RENDER WORKSPACE (If currentProjectId !== null)
  const totalWordSum = Object.values(wordCounts).reduce((a, b) => a + b, 0);
  const totalPages = Math.ceil(totalWordSum / 250);
  const totalReadMinutes = Math.ceil(totalWordSum / 200);
  const formatReadTime = (m: number) => {
    if (m <= 0) return '0 min';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* Top Header */}
      {!isDistractionFree && (
        <header className="flex justify-between items-center px-3 sm:px-5 py-3 border-b border-[var(--border)] bg-[var(--sidebar-bg)] select-none">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Tablet hamburger — toggles sidebar slide-over (sm to <lg only) */}
            {activeTab === 'editor' && (
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="hidden sm:flex lg:hidden items-center justify-center p-1.5 rounded hover:bg-[var(--border)] text-[var(--foreground)] transition-colors cursor-pointer"
                title="Open chapter list"
              >
                <Menu size={16} />
              </button>
            )}

            <button
              onClick={handleBackToDashboard}
              className="flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-md hover:bg-[var(--border)] transition-colors cursor-pointer text-[var(--foreground)]"
              title="Back to Novels Dashboard"
            >
              <ArrowLeft size={16} />
              <span className="font-semibold text-xs hidden sm:inline">{t('novels')}</span>
            </button>
            <span className="text-xs opacity-30 select-none hidden sm:inline">/</span>
            <span className="text-xs font-serif font-bold text-[var(--foreground)] opacity-85 select-none truncate">{project.title}</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Stats — full on lg, compact on md, hidden on phone */}
            <span className="text-xs font-mono opacity-80 mr-2 hidden md:flex items-center gap-2">
              <span>{totalWordSum.toLocaleString()} / {project.targetWordCount.toLocaleString()} {t('words')}</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border)] opacity-60 hidden lg:block" />
              <span className="hidden lg:inline">{totalPages.toLocaleString()} {totalPages === 1 ? t('page') : t('pages')}</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border)] opacity-60 hidden lg:block" />
              <span className="hidden lg:inline">{formatReadTime(totalReadMinutes)} {t('read')}</span>
            </span>

            {/* View / Tab Workspace buttons — hidden on phone (replaced by bottom nav) */}
            <div className="hidden sm:flex bg-[var(--border)] p-0.5 text-xs rounded-none">
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 font-semibold rounded-none transition-all cursor-pointer ${
                  activeTab === 'editor' ? 'bg-white dark:bg-[#20201e] shadow-sm text-[var(--accent)]' : 'opacity-75 hover:opacity-100'
                }`}
              >
                {t('write')}
              </button>
              <button
                onClick={() => setActiveTab('outline')}
                className={`px-3 py-1 font-semibold rounded-none transition-all cursor-pointer ${
                  activeTab === 'outline' ? 'bg-white dark:bg-[#20201e] shadow-sm text-[var(--accent)]' : 'opacity-75 hover:opacity-100'
                }`}
              >
                {t('outlineTab')}
              </button>
              <button
                onClick={() => setActiveTab('bible')}
                className={`px-3 py-1 font-semibold rounded-none transition-all cursor-pointer ${
                  activeTab === 'bible' ? 'bg-white dark:bg-[#20201e] shadow-sm text-[var(--accent)]' : 'opacity-75 hover:opacity-100'
                }`}
              >
                {t('bible')}
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-1 font-semibold rounded-none transition-all cursor-pointer ${
                  activeTab === 'settings' ? 'bg-white dark:bg-[#20201e] shadow-sm text-[var(--accent)]' : 'opacity-75 hover:opacity-100'
                }`}
              >
                {t('settingsTab')}
              </button>
            </div>

            <span className="w-px h-5 bg-[var(--border)] hidden sm:block" />

            {/* Snapshot history button */}
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="hidden sm:block p-1.5 rounded hover:bg-[var(--border)] text-[var(--foreground)] opacity-80 hover:opacity-100 transition-colors"
              title="Snapshots history"
            >
              <History size={16} />
            </button>

            {/* Export and backup button */}
            <button
              onClick={() => setIsExportOpen(true)}
              className="hidden sm:block p-1.5 rounded hover:bg-[var(--border)] text-[var(--foreground)] opacity-80 hover:opacity-100 transition-colors"
              title="Export & Backup options"
            >
              <Download size={16} />
            </button>

            {/* Feedback Link */}
            <a
              href="https://forms.gle/42RaT4ZCjLJreTsG7"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all text-xs font-semibold cursor-pointer border border-[var(--accent)]/25 hover:border-transparent"
              title={t('giveFeedback')}
            >
              <MessageSquare size={13} className="text-current" />
              <span>{t('feedback')}</span>
            </a>

            {/* General settings moved to Dashboard for workspace-level global scope */}

            {/* Phone overflow — opens the More bottom sheet */}
            <button
              onClick={() => setIsMobileMoreOpen(true)}
              className="sm:hidden p-1.5 rounded hover:bg-[var(--border)] text-[var(--foreground)] opacity-90 transition-colors cursor-pointer"
              title="More"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        </header>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden relative pb-12 sm:pb-0">
        {activeTab === 'editor' && (
          <>
            {/* Desktop sidebar (lg+) — always visible */}
            {!isDistractionFree && (
              <div className="hidden lg:block w-64 flex-shrink-0">
                <ChapterList
                  chapters={chapters}
                  activeChapterId={project.activeChapterId}
                  chapterOrder={project.chapterOrder}
                  wordCounts={wordCounts}
                  onSelectChapter={handleSelectChapter}
                  onCreateChapter={handleCreateChapter}
                  onDeleteChapter={handleDeleteChapter}
                  onOpenRestoreDeletedChapters={() => setIsRestoreDeletedOpen(true)}
                  characters={characters.characters}
                  locations={locations.locations}
                  onSelectBibleItem={(type, id) => {
                    setActiveTab('bible');
                    setBibleTab(type);
                    if (type === 'characters') {
                      setSelectedCharId(id);
                    } else if (type === 'locations') {
                      setSelectedLocId(id);
                    }
                  }}
                />
              </div>
            )}

            {/* Tablet slide-over sidebar (sm to <lg) */}
            {!isDistractionFree && isMobileSidebarOpen && (
              <>
                <div
                  className="hidden sm:block lg:hidden fixed inset-0 bg-black/40 z-30"
                  onClick={() => setIsMobileSidebarOpen(false)}
                />
                <div className="hidden sm:block lg:hidden fixed inset-y-0 left-0 w-72 z-40 shadow-xl">
                  <ChapterList
                    chapters={chapters}
                    activeChapterId={project.activeChapterId}
                    chapterOrder={project.chapterOrder}
                    wordCounts={wordCounts}
                    onSelectChapter={(id) => {
                      handleSelectChapter(id);
                      setIsMobileSidebarOpen(false);
                    }}
                    onCreateChapter={handleCreateChapter}
                    onDeleteChapter={handleDeleteChapter}
                    onOpenRestoreDeletedChapters={() => setIsRestoreDeletedOpen(true)}
                    characters={characters.characters}
                    locations={locations.locations}
                    onSelectBibleItem={(type, id) => {
                      setActiveTab('bible');
                      setBibleTab(type);
                      if (type === 'characters') setSelectedCharId(id);
                      else if (type === 'locations') setSelectedLocId(id);
                      setIsMobileSidebarOpen(false);
                    }}
                  />
                </div>
              </>
            )}

            {/* Phone full-screen chapters view (when bottom-nav "Chapters" is active) */}
            {mobileView === 'chapters' && (
              <div className="sm:hidden absolute inset-0 z-20">
                <ChapterList
                  chapters={chapters}
                  activeChapterId={project.activeChapterId}
                  chapterOrder={project.chapterOrder}
                  wordCounts={wordCounts}
                  onSelectChapter={(id) => {
                    handleSelectChapter(id);
                    setMobileView('main');
                  }}
                  onCreateChapter={handleCreateChapter}
                  onDeleteChapter={handleDeleteChapter}
                  onOpenRestoreDeletedChapters={() => setIsRestoreDeletedOpen(true)}
                  characters={characters.characters}
                  locations={locations.locations}
                  onSelectBibleItem={(type, id) => {
                    setActiveTab('bible');
                    setBibleTab(type);
                    if (type === 'characters') setSelectedCharId(id);
                    else if (type === 'locations') setSelectedLocId(id);
                  }}
                />
              </div>
            )}

            {/* Canvas Area */}
            <div className="flex-1 overflow-hidden h-full flex">
              <div className="flex-1 overflow-hidden h-full">
                {project.activeChapterId ? (
                  <EditorCanvas
                    ref={editorRef}
                    chapterId={project.activeChapterId}
                    chapterIndex={(project.chapterOrder ?? []).indexOf(project.activeChapterId) + 1}
                    initialTitle={chapters.find((c) => c.id === project.activeChapterId)?.title || ''}
                    initialMarkdown={activeChapterMarkdown}
                    typography={globalTypography}
                    onChangeTypography={handleChangeTypography}
                    onSave={handleSaveChapterMarkdown}
                    onWordCountChange={handleWordCountUpdate}
                    onManualSnapshot={handleManualSnapshot}
                    onTitleChange={(title) => handleRenameChapter(project.activeChapterId, title)}
                    isDistractionFree={isDistractionFree}
                    onToggleDistractionFree={() => setIsDistractionFree(!isDistractionFree)}
                    jumpToSearchQuery={jumpToSearchQuery}
                    onClearJumpToSearchQuery={() => setJumpToSearchQuery(null)}
                    characters={characters.characters}
                    locations={locations.locations}
                    items={items.items}
                    highlightBibleRefs={project.highlightBibleRefs ?? true}
                    onToggleHighlightBibleRefs={() => handleUpdateProject({ highlightBibleRefs: !(project.highlightBibleRefs ?? true) })}
                    onAttachEvidence={handleAttachEvidence}
                    aiLevel={workspaceAI.level}
                    isAIPanelOpen={isAIPanelOpen}
                    onToggleAIPanel={() => setIsAIPanelOpen(!isAIPanelOpen)}
                    onOpenBibleCharacter={(charId) => {
                      setActiveTab('bible');
                      setBibleTab('characters');
                      setSelectedCharId(charId);
                    }}
                    onOpenBibleLocation={(locId) => {
                      setActiveTab('bible');
                      setBibleTab('locations');
                      setSelectedLocId(locId);
                    }}
                    onOpenBibleItem={(itemId) => {
                      setActiveTab('bible');
                      setBibleTab('items');
                      setSelectedItemId(itemId);
                    }}
                    onSelectionChange={setActiveSelection}
                    onBeatClick={(beatId) => {
                      setActiveBeatId(beatId);
                      if (beatId) {
                        const data = getBeatData(beatId);
                        setAiPanelSelectedActionId(data?.mode || 'write_beat');
                        setIsAIPanelOpen(true);
                      }
                    }}
                    getBeatData={getBeatData}
                    activeBeatId={activeBeatId}
                  />
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center text-xs opacity-50 bg-[var(--editor-bg)]">
                    <span>{t('noChapters')}</span>
                    <button
                      onClick={handleCreateChapter}
                      className="mt-4 px-4 py-2 bg-[var(--accent)] text-white font-medium rounded-none hover:opacity-90 cursor-pointer"
                    >
                      {t('addChapter')}
                    </button>
                  </div>
                )}
              </div>
              <AIPanel
                isOpen={isAIPanelOpen && workspaceAI.level >= 1}
                onClose={() => setIsAIPanelOpen(false)}
                workspaceAI={workspaceAI}
                onOpenPreferences={() => { setShowAISettingsPage(true); setSettingsTab('ai'); }}
                hasProject={!!project}
                project={project}
                activeChapterMarkdown={activeChapterMarkdown}
                selectionText={selectionText}
                activeSelection={activeSelection}
                activeChapterId={project?.activeChapterId}
                runTool={handleRunTool}
                onExecuteWriteOp={handleExecuteWriteOp}
                transcript={aiTranscript}
                setTranscript={setAiTranscript}
                selectedActionId={aiPanelSelectedActionId}
                onSelectActionId={setAiPanelSelectedActionId}
                activeBeatId={activeBeatId}
                activeBeatData={activeBeatId ? beats[activeBeatId] : null}
                getBeatSurroundingText={(beatId) => editorRef.current?.getBeatSurroundingText(beatId) || null}
                onUpdateBeatData={handleUpdateBeatData}
              />
              <SnapshotHistoryPanel
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                storage={storage}
                projectId={project.id}
                chapterId={project.activeChapterId}
                onRestored={(text) => {
                  setActiveChapterMarkdown(text);
                }}
              />
            </div>
            {/* Floating Quick Create — shown near small text selections */}
            {!!project && selectionText.trim() && isSmallSelection(selectionText) && (
              <QuickCreateDialog
                selectionText={selectionText}
                onExecuteWriteOp={handleExecuteWriteOp}
                onDismiss={() => setActiveSelection(null)}
              />
            )}
            {/* Floating AI Toolbar — shown near long text selections for AI Level >= 1 */}
            {!!project && selectionText.trim() && !isSmallSelection(selectionText) && workspaceAI.level >= 1 && !hideSelectionToolbar && (
              <SelectionAIToolbar
                selectionText={selectionText}
                aiLevel={workspaceAI.level}
                onSelectAction={(actionId) => {
                  setAiPanelSelectedActionId(actionId);
                  setIsAIPanelOpen(true);
                  setHideSelectionToolbar(true);
                }}
                onDismiss={() => {
                  setHideSelectionToolbar(true);
                }}
              />
            )}
          </>
        )}

        {activeTab === 'outline' && (
          <div className="flex-1 overflow-hidden h-full">
            <OutlineGrid
              chapters={chapters}
              chapterOrder={project.chapterOrder}
              wordCounts={wordCounts}
              chaptersWithHistory={chaptersWithHistory}
              projectTitle={project.title}
              projectAuthor={project.author}
              onSelectChapter={(id) => {
                handleSelectChapter(id);
                setActiveTab('editor');
              }}
              onCreateChapter={handleCreateChapter}
              onSelectChapterContinuity={async (id) => {
                await handleSelectChapter(id);
                setBibleTab('continuity');
                setActiveTab('bible');
              }}
              onUpdateChapterStatus={handleUpdateChapterStatus}
              onDeleteChapter={handleDeleteChapter}
              onReorderChapters={handleReorderChapters}
              onOpenHistory={(id) => {
                handleSelectChapter(id);
                setIsHistoryOpen(true);
              }}
            />
          </div>
        )}

        {activeTab === 'bible' && (
          <div className="flex-1 overflow-hidden h-full">
            <BibleWorkspace
              characters={characters}
              locations={locations}
              items={items}
              style={style}
              continuityList={continuityList}
              chapters={chapters}
              activeChapterId={project.activeChapterId}
              bibleTab={bibleTab}
              onChangeBibleTab={setBibleTab}
              selectedCharId={selectedCharId}
              onSelectChar={setSelectedCharId}
              selectedLocId={selectedLocId}
              onSelectLoc={setSelectedLocId}
              selectedItemId={selectedItemId}
              onSelectItem={setSelectedItemId}
              onUpdateCharacters={async (c) => {
                setCharacters({ schemaVersion: 1, characters: c });
                const prefix = `projects/${project.id}/`;
                await storage.writeFile(`${prefix}Characters.json`, JSON.stringify({ schemaVersion: 1, characters: c }));
              }}
              onUpdateLocations={async (l) => {
                setLocations({ schemaVersion: 1, locations: l });
                const prefix = `projects/${project.id}/`;
                await storage.writeFile(`${prefix}Locations.json`, JSON.stringify({ schemaVersion: 1, locations: l }));
              }}
              onUpdateItems={async (i) => {
                setItems({ schemaVersion: 1, items: i });
                const prefix = `projects/${project.id}/`;
                await storage.writeFile(`${prefix}Items.json`, JSON.stringify({ schemaVersion: 1, items: i }));
              }}
              onUpdateStyle={async (s) => {
                setStyle(s);
                const prefix = `projects/${project.id}/`;
                await storage.writeFile(`${prefix}Style.json`, JSON.stringify(s));
              }}
              onUpdateContinuity={handleUpdateContinuity}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex-1 overflow-hidden h-full">
            <ProjectSettings
              project={project}
              onUpdateProject={handleUpdateProject}
              characters={characters.characters}
              allSeries={allSeries}
              onSwitchToBibleCharacters={() => {
                setActiveTab('bible');
                setBibleTab('characters');
              }}
              onArchiveProject={handleArchiveProject}
              onDeleteProject={handleDeleteActiveProject}
            />
          </div>
        )}
      </div>

      {/* Phone bottom segmented nav — hidden when distraction-free */}
      {!isDistractionFree && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-[var(--border)] bg-[var(--sidebar-bg)] select-none">
          <button
            onClick={() => { setActiveTab('editor'); setMobileView('main'); }}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
              activeTab === 'editor' && mobileView === 'main'
                ? 'text-[var(--accent)] bg-[var(--editor-bg)]'
                : 'text-[var(--foreground)] opacity-75'
            }`}
          >
            <BookOpen size={16} />
            <span className="text-[10px] font-semibold">{t('write')}</span>
          </button>
          <button
            onClick={() => { setActiveTab('editor'); setMobileView('chapters'); }}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors border-l border-[var(--border)] ${
              mobileView === 'chapters'
                ? 'text-[var(--accent)] bg-[var(--editor-bg)]'
                : 'text-[var(--foreground)] opacity-75'
            }`}
          >
            <Menu size={16} />
            <span className="text-[10px] font-semibold">{t('chaptersMobile')}</span>
          </button>
          <button
            onClick={() => setIsMobileMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors border-l border-[var(--border)] text-[var(--foreground)] opacity-75 hover:opacity-100"
          >
            <MoreHorizontal size={16} />
            <span className="text-[10px] font-semibold">{t('moreMobile')}</span>
          </button>
        </nav>
      )}

      {/* Phone "More" bottom sheet */}
      {isMobileMoreOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsMobileMoreOpen(false)} />
          <div className="relative bg-[var(--editor-bg)] border-t border-[var(--border)] rounded-t-2xl p-2 pb-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">{t('moreMobile')}</span>
              <button
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-1 rounded hover:bg-[var(--border)] text-[var(--foreground)] opacity-70"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            {[
              { label: t('outlineTab'), icon: BookOpen, onClick: () => { setActiveTab('outline'); setIsMobileMoreOpen(false); } },
              { label: t('bible'), icon: BookOpen, onClick: () => { setActiveTab('bible'); setIsMobileMoreOpen(false); } },
              { label: t('settingsTab'), icon: Settings, onClick: () => { setActiveTab('settings'); setIsMobileMoreOpen(false); } },
              { label: t('snapshots'), icon: History, onClick: () => { setIsHistoryOpen(true); setIsMobileMoreOpen(false); } },
              { label: t('export'), icon: Download, onClick: () => { setIsExportOpen(true); setIsMobileMoreOpen(false); } },
              { label: t('distractionFree'), icon: Maximize2, onClick: () => { setIsDistractionFree(true); setIsMobileMoreOpen(false); } },
              { label: t('generalSettings'), icon: Settings, onClick: () => { setShowAISettingsPage(true); setSettingsTab('general'); setIsMobileMoreOpen(false); } },
              { label: t('aiSettings'), icon: Sparkles, onClick: () => { setShowAISettingsPage(true); setSettingsTab('ai'); setIsMobileMoreOpen(false); } },
              { label: t('giveFeedback'), icon: MessageSquare, onClick: () => { window.open('https://forms.gle/42RaT4ZCjLJreTsG7', '_blank'); setIsMobileMoreOpen(false); } },
            ].map(({ label, icon: Icon, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[var(--foreground)] hover:bg-[var(--border)]/50 transition-colors rounded text-left"
              >
                <Icon size={16} className="opacity-70" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}



      {/* Export / Import Dialog */}
      {project && storage && (
        <ExportImportDialog
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          storage={storage}
          chapterOrder={project.chapterOrder}
          chapters={chapters}
          project={project}
        />
      )}

      {/* Restore Deleted Chapters Dialog */}
      {project && storage && (
        <RestoreDeletedChaptersDialog
          isOpen={isRestoreDeletedOpen}
          onClose={() => setIsRestoreDeletedOpen(false)}
          storage={storage}
          projectId={project.id}
          activeChapterOrder={project.chapterOrder}
          onRestoreChapter={handleRestoreDeletedChapter}
        />
      )}


      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        title={t('deleteChapter')}
        message={t('deleteChapterMsg')}
        onConfirm={confirmDeleteChapter}
        onCancel={() => setDeleteConfirmId(null)}
      />

      {/* Command Palette */}
      {isCommandPaletteOpen && project && (
        <CommandPalette
          chapters={chapters}
          activeChapterId={project.activeChapterId}
          chapterOrder={project.chapterOrder}
          onSelectChapter={(id) => {
            handleSelectChapter(id);
            setIsCommandPaletteOpen(false);
          }}
          onSearchManuscript={handleSearchManuscript}
          onSelectSnippet={(chapterId, query) => {
            handleSelectChapter(chapterId);
            setActiveTab('editor');
            setJumpToSearchQuery(query);
            setIsCommandPaletteOpen(false);
          }}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
      )}
    </div>
  );
}
