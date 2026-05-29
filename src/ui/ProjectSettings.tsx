import React, { useState } from 'react';
import { Project, Character } from '../storage/schemas';
import { useTranslation } from '../i18n/useTranslation';
import { Trash2, Archive, ShieldAlert, Image as ImageIcon } from 'lucide-react';

interface ProjectSettingsProps {
  project: Project;
  onUpdateProject: (updated: Partial<Project>) => void;
  characters: Character[];
  allSeries: string[];
  onSwitchToBibleCharacters: () => void;
  onArchiveProject: (archived: boolean) => void;
  onDeleteProject: () => void;
}

export default function ProjectSettings({
  project,
  onUpdateProject,
  characters,
  allSeries,
  onSwitchToBibleCharacters,
  onArchiveProject,
  onDeleteProject,
}: ProjectSettingsProps) {
  const { t } = useTranslation();
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const isDeleteButtonEnabled = deleteConfirmText === project.title;

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reject files > 5MB before canvas check just as safety
    if (file.size > 5 * 1024 * 1024) {
      alert(t('fileTooLarge'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxEdge = 1200;

        if (width > maxEdge || height > maxEdge) {
          if (width > height) {
            height = Math.round((height * maxEdge) / width);
            width = maxEdge;
          } else {
            width = Math.round((width * maxEdge) / height);
            height = maxEdge;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/webp', 0.85); // Compress as WebP base64
          onUpdateProject({ coverImage: base64 });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCover = () => {
    if (confirm(t('removeCoverConfirm'))) {
      onUpdateProject({ coverImage: undefined });
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[var(--editor-bg)] p-6 md:p-8 space-y-8 select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Title */}
        <div className="pb-3 border-b border-[var(--border)]">
          <h2 className="text-xl font-bold uppercase tracking-wider text-[var(--foreground)]">{t('settings')}</h2>
          <p className="text-xs opacity-70">{t('settingsSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Metadata Card */}
          <div className="bg-white dark:bg-[#1e1e1d] border border-[var(--border)] p-5 rounded-none flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] border-b border-[var(--border)]/40 pb-2 mb-3">
                {t('novelIdentity')}
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] uppercase opacity-75 mb-1 font-semibold">{t('title')}</label>
                  <input
                    type="text"
                    value={project.title}
                    onChange={(e) => onUpdateProject({ title: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-none border border-[var(--border)] bg-transparent text-[var(--foreground)] text-xs focus:outline-none focus:border-[var(--accent)]"
                    placeholder={t('novelTitlePlaceholder')}
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase opacity-75 mb-1 font-semibold">{t('author')}</label>
                  <input
                    type="text"
                    value={project.author || ''}
                    onChange={(e) => onUpdateProject({ author: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-none border border-[var(--border)] bg-transparent text-[var(--foreground)] text-xs focus:outline-none focus:border-[var(--accent)]"
                    placeholder={t('authorPlaceholder')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] uppercase opacity-75 mb-1 font-semibold">{t('series')}</label>
                    <input
                      type="text"
                      list="series-list"
                      value={project.series || ''}
                      onChange={(e) => onUpdateProject({ series: e.target.value || undefined })}
                      className="w-full px-3 py-1.5 rounded-none border border-[var(--border)] bg-transparent text-[var(--foreground)] text-xs focus:outline-none focus:border-[var(--accent)]"
                      placeholder={t('seriesName')}
                    />
                    <datalist id="series-list">
                      {allSeries.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>

                  {project.series && (
                    <div>
                      <label className="block text-[11px] uppercase opacity-75 mb-1 font-semibold">{t('seriesIndex')}</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={project.seriesIndex || ''}
                        onChange={(e) => onUpdateProject({ seriesIndex: parseInt(e.target.value) || undefined })}
                        className="w-full px-3 py-1.5 rounded-none border border-[var(--border)] bg-transparent text-[var(--foreground)] text-xs focus:outline-none focus:border-[var(--accent)]"
                        placeholder="e.g. 1"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] uppercase opacity-75 mb-1 font-semibold">{t('targetWordCount')}</label>
                  <input
                    type="number"
                    min="1000"
                    step="5000"
                    value={project.targetWordCount}
                    onChange={(e) => onUpdateProject({ targetWordCount: parseInt(e.target.value) || 50000 })}
                    className="w-full px-3 py-1.5 rounded-none border border-[var(--border)] bg-transparent text-[var(--foreground)] text-xs focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cover Card */}
          <div className="bg-white dark:bg-[#1e1e1d] border border-[var(--border)] p-5 rounded-none flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] border-b border-[var(--border)]/40 pb-2 mb-3">
                {t('bookCover')}
              </h3>
              
              <div className="flex gap-4">
                {/* 3:4 Aspect Tile */}
                <div className="w-[105px] h-[140px] border border-[var(--border)] bg-[var(--editor-bg)] rounded-none flex flex-col items-center justify-center overflow-hidden relative shadow-sm shrink-0">
                  {project.coverImage ? (
                    <img src={project.coverImage} alt="Cover Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-2 opacity-40">
                      <ImageIcon size={24} className="mx-auto mb-1" />
                      <span className="text-[9px] font-bold leading-tight block">{t('noCover')}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-center space-y-3">
                  <p className="text-[10px] opacity-70 leading-relaxed">
                    {t('uploadCoverHint')}
                  </p>
                  
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 border border-[var(--border)] hover:bg-[var(--border)] text-xs font-semibold rounded-none cursor-pointer transition-colors text-[var(--foreground)] bg-[var(--background)]">
                      {t('uploadImage')}
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleCoverUpload}
                        className="hidden"
                      />
                    </label>

                    {project.coverImage && (
                      <button
                        onClick={handleRemoveCover}
                        className="px-3 py-1.5 border border-red-500/30 hover:border-red-500/80 hover:bg-red-500/5 text-red-500 text-xs font-semibold rounded-none cursor-pointer transition-colors"
                      >
                        {t('remove')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Prose Discipline Card */}
          <div className="bg-white dark:bg-[#1e1e1d] border border-[var(--border)] p-5 rounded-none flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)] border-b border-[var(--border)]/40 pb-2 mb-3">
                {t('proseDiscipline')}
              </h3>

              <div className="space-y-4">
                {/* Tense */}
                <div>
                  <label className="block text-[11px] uppercase opacity-75 mb-1.5 font-semibold">{t('manuscriptTense')}</label>
                  <div className="flex bg-[var(--border)] p-0.5 rounded-none w-fit">
                    {(['past', 'present'] as const).map((tenseVal) => (
                      <button
                        key={tenseVal}
                        onClick={() => onUpdateProject({ tense: tenseVal })}
                        className={`px-3 py-1 rounded-none text-xs font-semibold capitalize transition-all cursor-pointer ${
                          project.tense === tenseVal
                            ? 'bg-white dark:bg-[#20201e] text-[var(--accent)] shadow-sm'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        {tenseVal === 'past' ? t('tensePast') : t('tensePresent')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Spell check Language */}
                <div>
                  <label className="block text-[11px] uppercase opacity-75 mb-1 font-semibold">{t('manuscriptLanguage')}</label>
                  <select
                    value={project.language || 'en'}
                    onChange={(e) => onUpdateProject({ language: e.target.value })}
                    className="w-48 px-3 py-1.5 rounded-none border border-[var(--border)] bg-transparent text-[var(--foreground)] text-xs focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="en">English (US/UK)</option>
                    <option value="vi">Tiếng Việt</option>
                  </select>
                </div>

                {/* Point of View */}
                <div>
                  <label className="block text-[11px] uppercase opacity-75 mb-1.5 font-semibold">{t('pointOfView')}</label>
                  <div className="flex flex-wrap bg-[var(--border)] p-0.5 rounded-none w-fit gap-0.5">
                    {(['first', 'second', 'third', 'third-limited', 'third-omniscient'] as const).map((pov) => {
                      const label = pov === 'third-limited' ? t('pov3rdLimited') : pov === 'third-omniscient' ? t('pov3rdOmniscient') : pov === 'first' ? t('pov1st') : pov === 'second' ? t('pov2nd') : t('pov3rd');
                      return (
                        <button
                          key={pov}
                          onClick={() => onUpdateProject({ pov })}
                          className={`px-2.5 py-1 rounded-none text-xs font-semibold capitalize transition-all cursor-pointer ${
                            project.pov === pov
                              ? 'bg-white dark:bg-[#20201e] text-[var(--accent)] shadow-sm'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* POV Character picker (Only if 1st or 3rd-limited) */}
                {(project.pov === 'first' || project.pov === 'third-limited') && (
                  <div>
                    <label className="block text-[11px] uppercase opacity-75 mb-1 font-semibold">{t('povFocusChar')}</label>
                    {characters.length > 0 ? (
                      <select
                        value={project.povCharacterId || ''}
                        onChange={(e) => onUpdateProject({ povCharacterId: e.target.value || undefined })}
                        className="w-full px-3 py-1.5 rounded-none border border-[var(--border)] bg-transparent text-[var(--foreground)] text-xs focus:outline-none focus:border-[var(--accent)]"
                      >
                        <option value="">{t('noCharFocusSelected')}</option>
                        {characters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-[11px] p-2 bg-[var(--border)]/35 text-[var(--foreground)] border border-dashed border-[var(--border)]">
                        {t('noCharactersYet')}{' '}
                        <button
                          onClick={onSwitchToBibleCharacters}
                          className="text-[var(--accent)] font-semibold underline cursor-pointer inline-block"
                        >
                          {t('addCharInBible')}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Story Bible Live Linkage toggle */}
                <div className="flex items-center gap-2.5 pt-2 border-t border-[var(--border)]/20">
                  <input
                    type="checkbox"
                    id="highlightBibleRefs"
                    checked={project.highlightBibleRefs ?? true}
                    onChange={(e) => onUpdateProject({ highlightBibleRefs: e.target.checked })}
                    className="h-3.5 w-3.5 border-[var(--border)] rounded-none text-[var(--accent)] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <label htmlFor="highlightBibleRefs" className="text-xs font-semibold text-[var(--foreground)] opacity-85 cursor-pointer">
                    {t('highlightBibleRefs')}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone Card */}
          <div className="bg-red-50/10 dark:bg-red-950/5 border border-red-500/20 p-5 rounded-none flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-500 border-b border-red-500/20 pb-2 mb-3">
                {t('dangerZone')}
              </h3>

              <div className="space-y-4">
                {/* Soft Archiving */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-[var(--foreground)]">{t('archiveNovel')}</h4>
                    <p className="text-[10px] opacity-70 leading-relaxed">
                      {t('archiveNovelDesc')}
                    </p>
                  </div>
                  <button
                    onClick={() => onArchiveProject(!project.archived)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-[var(--border)] hover:bg-[var(--border)] text-xs font-bold rounded-none cursor-pointer transition-colors"
                  >
                    <Archive size={14} className="opacity-80" />
                    <span>{project.archived ? t('restoreNovel') : t('archiveNovel')}</span>
                  </button>
                </div>

                {/* Hard Deletion */}
                <div className="pt-4 border-t border-red-500/10 space-y-3">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-red-500 flex items-center gap-1.5">
                      <ShieldAlert size={14} />
                      {t('deleteNovelPermanently')}
                    </h4>
                    <p className="text-[10px] opacity-70 leading-relaxed">
                      {t('deleteNovelDesc')} <strong>This cannot be undone.</strong>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] opacity-80 font-bold">
                      {t('confirmDeleteType')} <span className="font-mono text-red-500 select-all">&quot;{project.title}&quot;</span>:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-none border border-red-500/30 bg-transparent text-[var(--foreground)] text-xs focus:outline-none focus:border-red-500"
                      placeholder={t('typeNovelTitle')}
                    />

                    <button
                      disabled={!isDeleteButtonEnabled}
                      onClick={onDeleteProject}
                      className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-none transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Trash2 size={14} />
                      <span>{t('deleteThisNovel')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
