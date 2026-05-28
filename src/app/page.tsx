"use client";

import React, { useEffect, useState } from 'react';
import { Settings, History, Palette } from 'lucide-react';
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

export default function WorkspacePage() {
  const { t } = useTranslation();
  const [storage, setStorage] = useState<ProjectStorage | null>(null);

  // States
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
  const [style, setStyle] = useState<Style>({
    schemaVersion: 1,
    rhythm: {
      avgSentenceLengthHint: '',
      paragraphLengthHint: '',
      rhythmNotes: '',
    },
    diction: {
      register: '',
      formality: 'neutral',
      favoredWords: [],
      avoidedWords: [],
    },
    dialogue: {
      taggingConvention: '',
      registerNotes: '',
      dialectMarkers: [],
    },
    narrativeRegister: { pointOfView: 'third-limited', tense: 'past', interiority: 'medium' },
    sensoryPalette: {
      dominantSenses: [],
      colorNotes: '',
      soundNotes: '',
    },
    pronounPairs: [],
  });
  const [continuityList, setContinuityList] = useState<Record<string, string>>({});

  // Layout states
  const [activeTab, setActiveTab] = useState<'editor' | 'bible'>('editor');
  const [isDistractionFree, setIsDistractionFree] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Modal dialog toggles
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Initialize DB & load or seed project
  useEffect(() => {
    const store = new IndexedDBProjectStorage();
    setStorage(store);

    const init = async () => {
      const isInitialized = await store.exists('xnovelist.json');
      
      if (!isInitialized) {
        // Seed default project structure
        const defaultProject: Project = {
          schemaVersion: 1,
          id: 'proj-default',
          title: 'My Masterpiece',
          author: '',
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
          },
        };

        const defaultChapter: Chapter = {
          id: 'chapter-1',
          title: 'Chapter 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await store.writeFile('Project.json', JSON.stringify(defaultProject));
        await store.writeFile('xnovelist.json', 'true');
        await store.writeFile('Characters.json', JSON.stringify({ schemaVersion: 1, characters: [] }));
        await store.writeFile('Locations.json', JSON.stringify({ schemaVersion: 1, locations: [] }));
        await store.writeFile('Style.json', JSON.stringify({
          schemaVersion: 1,
          rhythm: {
            avgSentenceLengthHint: '',
            paragraphLengthHint: '',
            rhythmNotes: '',
          },
          diction: {
            register: '',
            formality: 'neutral',
            favoredWords: [],
            avoidedWords: [],
          },
          dialogue: {
            taggingConvention: '',
            registerNotes: '',
            dialectMarkers: [],
          },
          narrativeRegister: { pointOfView: 'third-limited', tense: 'past', interiority: 'medium' },
          sensoryPalette: {
            dominantSenses: [],
            colorNotes: '',
            soundNotes: '',
          },
          pronounPairs: [],
        }));
        await store.writeFile('Artifacts/chapter-chapter-1.md', '# Chapter 1\n\nStart writing your novel here...');

        setProject(defaultProject);
        setChapters([defaultChapter]);
        setActiveChapterMarkdown('# Chapter 1\n\nStart writing your novel here...');
        setWordCounts({ 'chapter-1': 5 });
      } else {
        // Load existing project
        const projectStr = await store.readFile('Project.json');
        if (projectStr) {
          const loadedProj: Project = JSON.parse(projectStr);
          setProject(loadedProj);

          // Load chapters
          const paths = await store.listFiles('Artifacts/chapter-');
          const loadedChapters: Chapter[] = [];
          const wCounts: Record<string, number> = {};

          for (const p of paths) {
            const id = p.replace('Artifacts/chapter-', '').replace('.md', '');
            const md = await store.readFile(p) || '';
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

          const activeMd = await store.readFile(`Artifacts/chapter-${loadedProj.activeChapterId}.md`) || '';
          setActiveChapterMarkdown(activeMd);
        }

        // Load Story Bible
        const charsStr = await store.readFile('Characters.json');
        if (charsStr) setCharacters(JSON.parse(charsStr));

        const locsStr = await store.readFile('Locations.json');
        if (locsStr) setLocations(JSON.parse(locsStr));

        const styleStr = await store.readFile('Style.json');
        if (styleStr) setStyle(JSON.parse(styleStr));

        // Load continuity files
        const contPaths = await store.listFiles('Continuity/');
        const loadedContinuity: Record<string, string> = {};
        for (const p of contPaths) {
          const id = p.replace('Continuity/chapter-', '').replace('.md', '');
          const content = await store.readFile(p) || '';
          loadedContinuity[id] = content;
        }
        setContinuityList(loadedContinuity);
      }
    };

    init();
  }, []);

  // Theme Syncing
  useEffect(() => {
    const bodyClass = document.body.classList;
    if (theme === 'dark') {
      bodyClass.add('dark-theme');
    } else {
      bodyClass.remove('dark-theme');
    }
  }, [theme]);

  // Periodic interval snapshotting (runs every 30 minutes of active draft use)
  useEffect(() => {
    if (!storage || !project) return;
    const interval = setInterval(() => {
      takeSnapshot(storage, project.activeChapterId, 'interval', 'Auto-saved 30-minute interval');
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [storage, project]);

  if (!storage || !project) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
        <span className="text-sm font-medium tracking-wide animate-pulse">{t('loading')}</span>
      </div>
    );
  }

  // Active Chapter select handler
  const handleSelectChapter = async (id: string) => {
    const activeMd = await storage.readFile(`Artifacts/chapter-${id}.md`) || '';
    setActiveChapterMarkdown(activeMd);
    
    const updated = { ...project, activeChapterId: id };
    setProject(updated);
    await storage.writeFile('Project.json', JSON.stringify(updated));
  };

  // Create chapter handler
  const handleCreateChapter = async () => {
    const id = `chapter-${Date.now()}`;
    const newTitle = `Chapter ${chapters.length + 1}`;
    const newChapter: Chapter = {
      id,
      title: newTitle,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newMarkdown = `# ${newTitle}\n\n`;
    await storage.writeFile(`Artifacts/chapter-${id}.md`, newMarkdown);

    const updatedOrder = [...project.chapterOrder, id];
    const updatedProject = { ...project, activeChapterId: id, chapterOrder: updatedOrder };
    
    setChapters([...chapters, newChapter]);
    setWordCounts({ ...wordCounts, [id]: 2 });
    setProject(updatedProject);
    setActiveChapterMarkdown(newMarkdown);

    await storage.writeFile('Project.json', JSON.stringify(updatedProject));
    await takeSnapshot(storage, id, 'manual', 'Chapter Created', newMarkdown);
  };

  // Rename chapter handler
  const handleRenameChapter = async (id: string, newTitle: string) => {
    setChapters(chapters.map((c) => (c.id === id ? { ...c, title: newTitle } : c)));
    
    const filePath = `Artifacts/chapter-${id}.md`;
    const content = await storage.readFile(filePath) || '';
    
    // Replace the first line (H1) with the new title
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
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    
    // Take a quick backup snapshot first
    await takeSnapshot(storage, id, 'pre-restore', 'Auto backup before deletion');

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

    await storage.deleteFile(`Artifacts/chapter-${id}.md`);
    await storage.writeFile('Project.json', JSON.stringify(updatedProject));

    if (activeId) {
      const activeMd = await storage.readFile(`Artifacts/chapter-${activeId}.md`) || '';
      setActiveChapterMarkdown(activeMd);
    } else {
      setActiveChapterMarkdown('');
    }
  };

  // Reorder chapters handler
  const handleReorderChapters = async (newOrder: string[]) => {
    const updated = { ...project, chapterOrder: newOrder };
    setProject(updated);
    await storage.writeFile('Project.json', JSON.stringify(updated));
  };

  // Editor prose save handler
  const handleSaveChapterMarkdown = async (markdown: string, count: number) => {
    const filePath = `Artifacts/chapter-${project.activeChapterId}.md`;
    await storage.writeFile(filePath, markdown);
    
    setWordCounts((prev) => ({ ...prev, [project.activeChapterId]: count }));
  };

  // Project properties update handler
  const handleUpdateProject = async (updated: Partial<Project>) => {
    const updatedProject = { ...project, ...updated } as Project;
    setProject(updatedProject);
    await storage.writeFile('Project.json', JSON.stringify(updatedProject));
  };

  // Typography settings modifier
  const handleChangeTypography = (settings: Partial<Project['typography']>) => {
    const updatedProj = {
      ...project,
      typography: { ...project.typography, ...settings },
    } as Project;
    setProject(updatedProj);
    storage.writeFile('Project.json', JSON.stringify(updatedProj));
  };

  // Continuity document tracker
  const handleUpdateContinuity = async (chapterId: string, content: string) => {
    setContinuityList((prev) => ({ ...prev, [chapterId]: content }));
    await storage.writeFile(`Continuity/chapter-${chapterId}.md`, content);
  };

  // Word count sum calculator
  const totalWordSum = Object.values(wordCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* Top Header */}
      {!isDistractionFree && (
        <header className="flex justify-between items-center px-5 py-3 border-b border-[var(--border)] bg-[var(--sidebar-bg)] select-none">
          <div className="flex items-center gap-4">
            <span className="font-bold text-sm tracking-widest text-[var(--foreground)] opacity-95">
              XNOVELIST
            </span>
            <span className="text-xs opacity-60">|</span>
            <span className="text-xs font-semibold">{project.title}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono opacity-80 mr-2">
              {totalWordSum} / {project.targetWordCount} words
            </span>

            {/* View / Tab Workspace buttons */}
            <div className="flex bg-[var(--border)] rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === 'editor' ? 'bg-white dark:bg-[#20201e] shadow-sm' : 'opacity-75'
                }`}
              >
                {t('write')}
              </button>
              <button
                onClick={() => setActiveTab('bible')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === 'bible' ? 'bg-white dark:bg-[#20201e] shadow-sm' : 'opacity-75'
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
              <Palette size={16} />
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
                  typography={project.typography}
                  onChangeTypography={handleChangeTypography}
                  onSave={handleSaveChapterMarkdown}
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
              onUpdateCharacters={async (c) => {
                setCharacters({ schemaVersion: 1, characters: c });
                await storage.writeFile('Characters.json', JSON.stringify({ schemaVersion: 1, characters: c }));
              }}
              onUpdateLocations={async (l) => {
                setLocations({ schemaVersion: 1, locations: l });
                await storage.writeFile('Locations.json', JSON.stringify({ schemaVersion: 1, locations: l }));
              }}
              onUpdateStyle={async (s) => {
                setStyle(s);
                await storage.writeFile('Style.json', JSON.stringify(s));
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
