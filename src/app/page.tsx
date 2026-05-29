"use client";

import React, { useEffect, useState } from 'react';
import { Settings, History, Palette, Plus, FolderPlus, ArrowLeft, Download } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { IndexedDBProjectStorage } from '../storage/IndexedDBProjectStorage';
import { ProjectStorage } from '../storage/ProjectStorage';
import { Project, Chapter, Character, Location, Style } from '../storage/schemas';
import { takeSnapshot } from '../storage/snapshots';
import ChapterList from '../editor/ChapterList';
import EditorCanvas from '../editor/EditorCanvas';
import BibleWorkspace from '../bible/BibleWorkspace';
import SettingsDialog from '../ui/SettingsDialog';
import ExportImportDialog from '../ui/ExportImportDialog';
import SnapshotHistoryDialog from '../ui/SnapshotHistoryDialog';
import ConfirmDialog from '../ui/ConfirmDialog';

interface ProjectListItem {
  id: string;
  title: string;
  author: string;
  updatedAt: string;
}

export default function WorkspacePage() {
  const { t } = useTranslation();
  const [storage, setStorage] = useState<ProjectStorage | null>(null);

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

  // Lifted selection states for Story Bible quick-nav
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);
  const [bibleTab, setBibleTab] = useState<'characters' | 'locations' | 'style' | 'continuity'>('characters');
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

  // Layout states
  const [activeTab, setActiveTab] = useState<'editor' | 'bible'>('editor');
  const [isDistractionFree, setIsDistractionFree] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

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

  // Load global format from localStorage on mount
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
    }
  }, []);

  // Modal dialog toggles
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [projectDeleteId, setProjectDeleteId] = useState<string | null>(null);

  // Initialize DB and load project registry
  useEffect(() => {
    const store = new IndexedDBProjectStorage();
    setStorage(store);

    const loadRegistry = async () => {
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
        };

        const prefix = `projects/${sampleId}/`;
        await store.writeFile(`${prefix}Project.json`, JSON.stringify(defaultProject));
        await store.writeFile(`${prefix}Characters.json`, JSON.stringify({ schemaVersion: 1, characters: [] }));
        await store.writeFile(`${prefix}Locations.json`, JSON.stringify({ schemaVersion: 1, locations: [] }));
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
  }, []);

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
      if (isSettingsOpen) { setIsSettingsOpen(false); return; }
      if (isExportOpen) { setIsExportOpen(false); return; }
      if (isHistoryOpen) { setIsHistoryOpen(false); return; }
      if (isCreateModalOpen) { setIsCreateModalOpen(false); return; }
      if (isDistractionFree) { setIsDistractionFree(false); return; }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [
    deleteConfirmId,
    projectDeleteId,
    isSettingsOpen,
    isExportOpen,
    isHistoryOpen,
    isCreateModalOpen,
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
  }, [theme]);

  // Interval snapshot — every 30 minutes of active writing the current
  // chapter is snapshotted to .history. Plan §7.6 calls for this.
  // takeSnapshot() de-dupes identical content via contentHash so an idle
  // tick does not bloat the history.
  useEffect(() => {
    if (!storage || !project?.activeChapterId) return;
    const id = window.setInterval(() => {
      takeSnapshot(storage, project.activeChapterId, 'interval', 'Auto interval snapshot', undefined, project.id)
        .catch(() => { /* ignore */ });
    }, 30 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [storage, project?.id, project?.activeChapterId]);

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

        loadedChapters.push({
          id,
          title: md.split('\n')[0].replace('#', '').trim() || `Chapter ${id}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      setChapters(loadedChapters);
      setWordCounts(wCounts);

      const activeMd = await activeStore.readFile(`${prefix}Artifacts/chapter-${loadedProj.activeChapterId}.md`) || '';
      setActiveChapterMarkdown(activeMd);
    }

    // Load Story Bible
    const charsStr = await activeStore.readFile(`${prefix}Characters.json`);
    if (charsStr) setCharacters(JSON.parse(charsStr));

    const locsStr = await activeStore.readFile(`${prefix}Locations.json`);
    if (locsStr) setLocations(JSON.parse(locsStr));

    const styleStr = await activeStore.readFile(`${prefix}Style.json`);
    if (styleStr) setStyle(JSON.parse(styleStr));

    // Load continuity files
    const contPaths = await activeStore.listFiles(`${prefix}Continuity/`);
    const loadedContinuity: Record<string, string> = {};
    for (const p of contPaths) {
      const id = p.replace(`${prefix}Continuity/chapter-`, '').replace('.md', '');
      const content = await activeStore.readFile(p) || '';
      loadedContinuity[id] = content;
    }
    setContinuityList(loadedContinuity);
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
    };

    const prefix = `projects/${projId}/`;
    await storage.writeFile(`${prefix}Project.json`, JSON.stringify(defaultProject));
    await storage.writeFile(`${prefix}Characters.json`, JSON.stringify({ schemaVersion: 1, characters: [] }));
    await storage.writeFile(`${prefix}Locations.json`, JSON.stringify({ schemaVersion: 1, locations: [] }));
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

    await takeSnapshot(storage, id, 'pre-restore', 'Auto backup before deletion', undefined, project.id);

    const updatedChapters = chapters.filter((c) => c.id !== id);
    const updatedOrder = project.chapterOrder.filter((chId) => chId !== id);

    let activeId = project.activeChapterId;
    if (activeId === id) {
      activeId = updatedOrder[0] || '';
    }

    const updatedProject = { ...project, activeChapterId: activeId, chapterOrder: updatedOrder };

    setChapters(updatedChapters);
    setProject(updatedProject);
    setDeleteConfirmId(null);

    await storage.deleteFile(`${prefix}Artifacts/chapter-${id}.md`);
    await storage.writeFile(`${prefix}Project.json`, JSON.stringify(updatedProject));

    if (activeId) {
      const activeMd = await storage.readFile(`${prefix}Artifacts/chapter-${activeId}.md`) || '';
      setActiveChapterMarkdown(activeMd);
    } else {
      setActiveChapterMarkdown('');
    }
  };

  // Reorder chapters handler
  const handleReorderChapters = async (newOrder: string[]) => {
    if (!storage || !project) return;
    const prefix = `projects/${project.id}/`;

    const updated = { ...project, chapterOrder: newOrder };
    setProject(updated);
    await storage.writeFile(`${prefix}Project.json`, JSON.stringify(updated));
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
  };

  if (!storage) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <span className="text-sm font-medium tracking-wide animate-pulse">{t('loading')}</span>
      </div>
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
                <p className="text-xs opacity-70">A local-first, distraction-free writing desk</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Theme toggler */}
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-2 rounded-lg border border-[var(--border)] hover:bg-[var(--sidebar-bg)] transition-colors text-xs font-semibold"
              >
                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              </button>
            </div>
          </div>

          {/* Grid Layout of cards */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold uppercase tracking-wider opacity-85">Your Novels</h2>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white hover:opacity-90 font-semibold rounded-lg text-xs transition-opacity shadow-sm"
              >
                <Plus size={16} />
                Create New Novel
              </button>
            </div>

            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-x-5 gap-y-8">
              {/* Novel cards */}
              {projectList.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleOpenProject(p.id)}
                  className="group relative cursor-pointer flex flex-col transition-all"
                >
                  {/* Book Cover Placeholder */}
                  <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-[var(--border)] shadow-sm bg-[#fbfbfa]">
                    {/* Default cover image background */}
                    <img src="cover1.svg" alt="Cover" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform" />
                  </div>

                  {/* Metadata under cover */}
                  <div className="mt-3 space-y-1">
                    <h3 className="font-serif font-bold text-sm text-[var(--foreground)] leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2 select-none">
                      {p.title}
                    </h3>
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
                <div className="w-full aspect-[3/4] rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--editor-bg)] flex flex-col items-center justify-center p-4 opacity-70 group-hover:opacity-100 group-hover:border-[var(--accent)] group-hover:bg-emerald-600/5 transition-all shadow-sm">
                  <FolderPlus size={24} className="text-[var(--accent)] mb-2" />
                  <span className="text-xs font-semibold text-center leading-tight">Start New Novel</span>
                </div>
                <div className="mt-3 space-y-1 opacity-60">
                  <h3 className="font-serif font-bold text-sm leading-snug truncate">Create Novel</h3>
                  <p className="text-[11px]">&nbsp;</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create Project Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 animate-fade-in select-none">
            <div className="bg-white dark:bg-[#1e1e1d] border border-[var(--border)] rounded-xl max-w-sm w-full p-6 shadow-xl space-y-4">
              <h3 className="text-base font-semibold text-[var(--foreground)] pb-2 border-b border-[var(--border)]">
                Create New Novel
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs uppercase opacity-75 mb-1">Novel Title</label>
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
                  <label className="block text-xs uppercase opacity-75 mb-1">Author Name</label>
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
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProjTitle.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Project Confirmation */}
        <ConfirmDialog
          isOpen={projectDeleteId !== null}
          title="Delete Novel"
          message="Are you sure you want to delete this novel? This will permanently wipe all draft chapters, Story Bible files, and local snapshot history from your browser storage. This cannot be undone."
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
        <header className="flex justify-between items-center px-5 py-3 border-b border-[var(--border)] bg-[var(--sidebar-bg)] select-none">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToDashboard}
              className="flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-md hover:bg-[var(--border)] transition-colors cursor-pointer text-[var(--foreground)]"
              title="Back to Novels Dashboard"
            >
              <ArrowLeft size={16} />
              <span className="font-semibold text-xs">Novels</span>
            </button>
            <span className="text-xs opacity-30 select-none">/</span>
            <span className="text-xs font-serif font-bold text-[var(--foreground)] opacity-85 select-none">{project.title}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono opacity-80 mr-2 flex items-center gap-2">
              <span>{totalWordSum.toLocaleString()} / {project.targetWordCount.toLocaleString()} words</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border)] opacity-60" />
              <span>{totalPages.toLocaleString()} {totalPages === 1 ? 'page' : 'pages'}</span>
              <span className="w-1 h-1 rounded-full bg-[var(--border)] opacity-60" />
              <span>{formatReadTime(totalReadMinutes)} read</span>
            </span>

            {/* View / Tab Workspace buttons */}
            <div className="flex bg-[var(--border)] rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${activeTab === 'editor' ? 'bg-white dark:bg-[#20201e] shadow-sm' : 'opacity-75'
                  }`}
              >
                {t('write')}
              </button>
              <button
                onClick={() => setActiveTab('bible')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${activeTab === 'bible' ? 'bg-white dark:bg-[#20201e] shadow-sm' : 'opacity-75'
                  }`}
              >
                {t('bible')}
              </button>
            </div>

            <span className="w-px h-5 bg-[var(--border)]" />

            {/* Snapshot history button */}
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-1.5 rounded hover:bg-[var(--border)] text-[var(--foreground)] opacity-80 hover:opacity-100 transition-colors"
              title="Snapshots history"
            >
              <History size={16} />
            </button>

            {/* Export and backup button */}
            <button
              onClick={() => setIsExportOpen(true)}
              className="p-1.5 rounded hover:bg-[var(--border)] text-[var(--foreground)] opacity-80 hover:opacity-100 transition-colors"
              title="Export & Backup options"
            >
              <Download size={16} />
            </button>

            {/* General setting dialog button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded hover:bg-[var(--border)] text-[var(--foreground)] opacity-80 hover:opacity-100 transition-colors"
              title="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </header>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'editor' ? (
          <>
            {/* Outline sidebar */}
            {!isDistractionFree && (
              <div className="w-64 flex-shrink-0">
                <ChapterList
                  chapters={chapters}
                  activeChapterId={project.activeChapterId}
                  chapterOrder={project.chapterOrder}
                  wordCounts={wordCounts}
                  onSelectChapter={handleSelectChapter}
                  onCreateChapter={handleCreateChapter}
                  onRenameChapter={handleRenameChapter}
                  onDeleteChapter={handleDeleteChapter}
                  onReorderChapters={handleReorderChapters}
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

            {/* Canvas Area */}
            <div className="flex-1 overflow-hidden h-full">
              {project.activeChapterId ? (
                <EditorCanvas
                  chapterId={project.activeChapterId}
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
                />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center text-xs opacity-50 bg-[var(--editor-bg)]">
                  <span>{t('noChapters')}</span>
                  <button
                    onClick={handleCreateChapter}
                    className="mt-4 px-4 py-2 bg-[var(--accent)] text-white font-medium rounded-md hover:opacity-90"
                  >
                    {t('addChapter')}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-hidden h-full">
            <BibleWorkspace
              characters={characters}
              locations={locations}
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
              onUpdateStyle={async (s) => {
                setStyle(s);
                const prefix = `projects/${project.id}/`;
                await storage.writeFile(`${prefix}Style.json`, JSON.stringify(s));
              }}
              onUpdateContinuity={handleUpdateContinuity}
            />
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        project={project}
        onUpdateProject={handleUpdateProject}
        theme={theme}
        onChangeTheme={setTheme}
      />

      {/* Export / Import Dialog */}
      <ExportImportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        storage={storage}
        chapterOrder={project.chapterOrder}
        chapters={chapters}
      />

      {/* History Snapshots Dialog */}
      <SnapshotHistoryDialog
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        storage={storage}
        projectId={project.id}
        chapterId={project.activeChapterId}
        onRestored={(text) => {
          setActiveChapterMarkdown(text);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        title={t('deleteChapter')}
        message="Are you sure you want to delete this chapter? This will wipe the draft contents, but a rollback pre-restore snapshot will be taken first."
        onConfirm={confirmDeleteChapter}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
