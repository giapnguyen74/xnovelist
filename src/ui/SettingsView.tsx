import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import {
  Sparkles, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp, Shield, ArrowRight, ArrowLeft,
  Settings, Laptop, Send, Loader2, Terminal
} from 'lucide-react';
import { WorkspaceAIConfig, ProviderId, OpenAIProviderConfig, AnthropicProviderConfig, OpenRouterProviderConfig, LocalAIProviderConfig } from '../storage/aiConfig';
import { fetchOpenRouterModels, OpenRouterModel } from '../engine/providers/openrouter';
import { suggestLocalBaseUrlCorrection, fetchLocalModels } from '../engine/providers/local';
import { testConnection, TestResult } from '../engine/testConnection';

interface SettingsViewProps {
  workspaceAI: WorkspaceAIConfig;
  onChangeAIConfig: (config: WorkspaceAIConfig) => Promise<void>;
  theme: 'light' | 'dark';
  onChangeTheme: (theme: 'light' | 'dark') => void;
  onBack: () => void;
  backLabel?: string;
  defaultTab?: 'general' | 'ai';
  snapshotIntervalMinutes: number;
  onChangeSnapshotInterval: (min: number) => void;
}

export default function SettingsView({
  workspaceAI,
  onChangeAIConfig,
  theme,
  onChangeTheme,
  onBack,
  backLabel,
  defaultTab = 'general',
  snapshotIntervalMinutes,
  onChangeSnapshotInterval,
}: SettingsViewProps) {
  const { t, lang, setLang } = useTranslation();
  const [activeTab, setActiveTab] = useState<'general' | 'ai'>(defaultTab);

  // Readiness checkers
  const isReady = (pid: ProviderId): boolean => {
    const config = workspaceAI.providers[pid];
    if (!config) return false;
    if (pid === 'openai') {
      const c = config as OpenAIProviderConfig;
      return !!c.apiKey;
    }
    if (pid === 'anthropic') {
      const c = config as AnthropicProviderConfig;
      return !!c.apiKey;
    }
    if (pid === 'openrouter') {
      const c = config as OpenRouterProviderConfig;
      return !!c.apiKey;
    }
    if (pid === 'local') {
      const c = config as LocalAIProviderConfig;
      return !!(c.baseUrl && c.defaultModel);
    }
    return false;
  };

  const readyProvidersList = (['openai', 'anthropic', 'openrouter', 'local'] as ProviderId[]).filter(isReady);

  // Collapsible cards state
  const [expandedProvider, setExpandedProvider] = useState<ProviderId | null>(null);

  // OpenRouter Models Cache
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [openRouterSearch, setOpenRouterSearch] = useState('');
  const [loadingOpenRouterModels, setLoadingOpenRouterModels] = useState(false);

  // Local AI Models
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [loadingLocalModels, setLoadingLocalModels] = useState(false);
  const [localUrlError, setLocalUrlError] = useState<string | null>(null);
  const [localUrlCorrection, setLocalUrlCorrection] = useState<string | null>(null);
  const [showAdvancedLocal, setShowAdvancedLocal] = useState(false);

  // Connection Test Status per provider
  const [testResults, setTestResults] = useState<Record<ProviderId, TestResult & { testing?: boolean } | null>>({
    openai: null,
    anthropic: null,
    openrouter: null,
    local: null,
  });

  // Debouncing test pings to once every 2 seconds
  const lastTestTime = useRef<Record<ProviderId, number>>({
    openai: 0,
    anthropic: 0,
    openrouter: 0,
    local: 0,
  });

  // Playground state
  const [playgroundProvider, setPlaygroundProvider] = useState<ProviderId>('openrouter');
  const [playgroundModel, setPlaygroundModel] = useState<string>('');
  const [playgroundPrompt, setPlaygroundPrompt] = useState<string>('Write a 2-sentence hook for a sci-fi novel about time travel.');
  const [playgroundTesting, setPlaygroundTesting] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState<TestResult | null>(null);

  useEffect(() => {
    if (readyProvidersList.length > 0) {
      if (!readyProvidersList.includes(playgroundProvider)) {
        setPlaygroundProvider(readyProvidersList[0]);
      }
    }
  }, [readyProvidersList, playgroundProvider]);

  useEffect(() => {
    const config = workspaceAI.providers[playgroundProvider];
    if (config) {
      setPlaygroundModel(config.defaultModel || '');
    }
  }, [playgroundProvider, workspaceAI.providers]);

  const handleSendPlaygroundPrompt = async () => {
    if (!playgroundModel.trim()) return;
    setPlaygroundTesting(true);
    setPlaygroundResult(null);
    try {
      const config = workspaceAI.providers[playgroundProvider];
      if (!config) {
        setPlaygroundResult({ ok: false, error: 'Provider configuration is empty.' });
        return;
      }
      const r = await testConnection(playgroundProvider, config, {
        modelId: playgroundModel.trim(),
        userPrompt: playgroundPrompt,
      });
      setPlaygroundResult(r);
    } catch (err) {
      setPlaygroundResult({ ok: false, error: (err as Error).message || String(err) });
    } finally {
      setPlaygroundTesting(false);
    }
  };

  // Load OpenRouter models if OpenRouter expanded
  useEffect(() => {
    if (expandedProvider === 'openrouter' && openRouterModels.length === 0) {
      setLoadingOpenRouterModels(true);
      fetchOpenRouterModels()
        .then(setOpenRouterModels)
        .finally(() => setLoadingOpenRouterModels(false));
    }
  }, [expandedProvider, openRouterModels.length]);

  // Load Local models if Local expanded and base URL is set
  useEffect(() => {
    const localConfig = workspaceAI.providers.local;
    if (expandedProvider === 'local' && localConfig?.baseUrl && localModels.length === 0) {
      setLoadingLocalModels(true);
      fetchLocalModels(localConfig.baseUrl, localConfig.apiKey, localConfig.headers)
        .then((models) => {
          if (models.length > 0) setLocalModels(models);
        })
        .finally(() => setLoadingLocalModels(false));
    }
  }, [expandedProvider, workspaceAI.providers.local, localModels.length]);

  // AI Level Descriptive captions
  const getLevelCaption = (lvl: number) => {
    switch (lvl) {
      case 0:
        return 'AI features are completely disabled. No data leaves this device.';
      case 1:
        return 'AI can summarize chapters, find entities in your story, and assist in planning. No edits to your draft will be made.';
      case 2:
        return 'AI can rewrite text you have selected, with your approval. It cannot edit anything else.';
      case 3:
        return 'AI can actively generate and continue writing drafts at your cursor. (Coming in future versions)';
      case 4:
        return 'AI operates in a co-writer model with proactive feedback. (Coming in future versions)';
      case 5:
        return 'Autonomous agent-based editing and stylistic tuning. (Coming in future versions)';
      default:
        return '';
    }
  };

  const handleLevelChange = async (lvl: number) => {
    const updated: WorkspaceAIConfig = {
      ...workspaceAI,
      level: lvl as 0 | 1 | 2 | 3 | 4 | 5,
    };
    await onChangeAIConfig(updated);
  };

  const handleToggleProvider = (pid: ProviderId) => {
    setExpandedProvider(expandedProvider === pid ? null : pid);
  };

  const updateProviderConfig = async (
    pid: ProviderId,
    updates: Partial<OpenAIProviderConfig> | Partial<AnthropicProviderConfig> | Partial<OpenRouterProviderConfig> | Partial<LocalAIProviderConfig>
  ) => {
    const updatedProviders = { ...workspaceAI.providers };
    if (pid === 'openai') {
      updatedProviders.openai = {
        ...updatedProviders.openai,
        ...(updates as Partial<OpenAIProviderConfig>),
      } as OpenAIProviderConfig;
    } else if (pid === 'anthropic') {
      updatedProviders.anthropic = {
        ...updatedProviders.anthropic,
        ...(updates as Partial<AnthropicProviderConfig>),
      } as AnthropicProviderConfig;
    } else if (pid === 'openrouter') {
      updatedProviders.openrouter = {
        ...updatedProviders.openrouter,
        ...(updates as Partial<OpenRouterProviderConfig>),
      } as OpenRouterProviderConfig;
    } else if (pid === 'local') {
      updatedProviders.local = {
        ...updatedProviders.local,
        ...(updates as Partial<LocalAIProviderConfig>),
      } as LocalAIProviderConfig;
    }

    const updatedConfig: WorkspaceAIConfig = {
      ...workspaceAI,
      providers: updatedProviders,
    };

    if (!updatedConfig.defaultProviderId && isReady(pid)) {
      updatedConfig.defaultProviderId = pid;
    }

    await onChangeAIConfig(updatedConfig);
  };

  const handleLocalBaseUrlBlur = (val: string) => {
    const correction = suggestLocalBaseUrlCorrection(val);
    setLocalUrlCorrection(correction);

    if (val.trim() && !val.startsWith('http://') && !val.startsWith('https://')) {
      setLocalUrlError('Base URL must include a protocol scheme, e.g. http://');
    } else {
      setLocalUrlError(null);
    }
  };

  const triggerConnectionTest = async (pid: ProviderId, currentConfig = workspaceAI) => {
    const now = Date.now();
    if (now - lastTestTime.current[pid] < 2000) {
      return;
    }
    lastTestTime.current[pid] = now;

    setTestResults((prev) => ({
      ...prev,
      [pid]: { ok: false, testing: true },
    }));

    const config = currentConfig.providers[pid];
    if (!config) {
      setTestResults((prev) => ({
        ...prev,
        [pid]: { ok: false, error: 'Provider is not configured.' },
      }));
      return;
    }

    const res = await testConnection(pid, config);
    setTestResults((prev) => ({
      ...prev,
      [pid]: res,
    }));
  };

  const handleDefaultProviderChange = async (pid: ProviderId) => {
    const updatedConfig: WorkspaceAIConfig = {
      ...workspaceAI,
      defaultProviderId: pid,
    };
    await onChangeAIConfig(updatedConfig);
    triggerConnectionTest(pid, updatedConfig);
  };

  return (
    <div className="fixed inset-0 bg-[var(--background)] overflow-y-auto text-[var(--foreground)] p-6 md:p-12 pb-32 z-40">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        
        {/* Header Controls */}
        <div className="flex items-center justify-between pb-6 border-b border-[var(--border)] shrink-0 gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[var(--border)] bg-white dark:bg-[#1a1a19] hover:bg-[var(--sidebar-bg)] transition-colors text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>{backLabel || t('backToDashboard')}</span>
          </button>
          
          <div className="text-right">
            <h1 className="text-xl font-bold tracking-wider uppercase flex items-center gap-2 justify-end">
              <Settings size={18} className="opacity-80" />
              <span>{t('generalSettings')}</span>
            </h1>
            <p className="text-xs opacity-60 mt-1">Manage UI configurations and AI capabilities</p>
          </div>
        </div>

        {/* Unified Custom Tabs */}
        <div className="flex border-b border-[var(--border)] gap-2 mb-4 shrink-0">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
              activeTab === 'general'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent opacity-65 hover:opacity-100 hover:border-[var(--border)]'
            }`}
          >
            <Laptop size={14} />
            <span>General Preferences</span>
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all border-b-2 cursor-pointer ${
              activeTab === 'ai'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent opacity-65 hover:opacity-100 hover:border-[var(--border)]'
            }`}
          >
            <Sparkles size={14} className={activeTab === 'ai' ? 'text-[var(--accent)] animate-pulse' : ''} />
            <span>AI Connections</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="py-2">
          
          {/* TAB 1: General Preferences */}
          {activeTab === 'general' && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--foreground)] opacity-85">Interface Settings</h3>
                <p className="text-[10px] opacity-60">Control visual presentation and display languages for your workspace.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Theme Selector */}
                <div className="bg-[var(--sidebar-bg)]/20 border border-[var(--border)] p-5 space-y-3 rounded-lg flex flex-col justify-between">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-75">{t('theme')}</label>
                    <p className="text-[10px] opacity-50">Toggle between dark and light appearance modes.</p>
                  </div>
                  <select
                    value={theme}
                    onChange={(e) => onChangeTheme(e.target.value as 'light' | 'dark')}
                    className="w-full px-3 py-2.5 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-xs focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                  >
                    <option value="light">{t('light')}</option>
                    <option value="dark">{t('dark')}</option>
                  </select>
                </div>

                {/* Language Selector */}
                <div className="bg-[var(--sidebar-bg)]/20 border border-[var(--border)] p-5 space-y-3 rounded-lg flex flex-col justify-between">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-75">{t('language')}</label>
                    <p className="text-[10px] opacity-50">Change overall menu interfaces and descriptive guides.</p>
                  </div>
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value as 'en' | 'vi')}
                    className="w-full px-3 py-2.5 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-xs focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                  >
                    <option value="en">English</option>
                    <option value="vi">Tiếng Việt</option>
                  </select>
                </div>

                {/* Auto-snapshot Interval Selector */}
                <div className="bg-[var(--sidebar-bg)]/20 border border-[var(--border)] p-5 space-y-3 rounded-lg flex flex-col justify-between">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-75">Auto-snapshot every...</label>
                    <p className="text-[10px] opacity-50">Automatically save backup snapshots of active chapters at regular intervals.</p>
                  </div>
                  <select
                    value={snapshotIntervalMinutes}
                    onChange={(e) => onChangeSnapshotInterval(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2.5 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-xs focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                  >
                    <option value={0}>Off</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: AI Connections */}
          {activeTab === 'ai' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* AI Level Slider */}
              <div className="bg-[var(--sidebar-bg)]/20 border border-[var(--border)] p-5 space-y-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-75">AI Capability Level</label>
                  <span className="px-2 py-0.5 bg-[var(--accent-light)] text-[var(--accent)] rounded font-mono font-bold text-xs uppercase tracking-wider">
                    Level {workspaceAI.level}
                  </span>
                </div>

                <div className="space-y-3 py-2">
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    value={workspaceAI.level}
                    onChange={(e) => handleLevelChange(parseInt(e.target.value))}
                    className="w-full h-2 bg-[var(--border)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)] focus:outline-none"
                    style={{
                      background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${workspaceAI.level * 20}%, var(--border) ${workspaceAI.level * 20}%, var(--border) 100%)`
                    }}
                  />
                  <div className="flex justify-between text-[9px] font-bold opacity-60 px-1 select-none">
                    <span className={workspaceAI.level === 0 ? "text-[var(--accent)]" : ""}>L0 (Off)</span>
                    <span className={workspaceAI.level === 1 ? "text-[var(--accent)]" : ""}>L1 (Read)</span>
                    <span className={workspaceAI.level === 2 ? "text-[var(--accent)]" : ""}>L2 (Edit)</span>
                    <span className={`${workspaceAI.level === 3 ? "text-[var(--accent)]" : ""} opacity-60`}>L3 (Soon)</span>
                    <span className={`${workspaceAI.level === 4 ? "text-[var(--accent)]" : ""} opacity-60`}>L4 (Soon)</span>
                    <span className={`${workspaceAI.level === 5 ? "text-[var(--accent)]" : ""} opacity-60`}>L5 (Soon)</span>
                  </div>
                </div>

                <div className="text-[11px] opacity-75 flex items-start gap-1.5 p-3 bg-white/40 dark:bg-black/10 border border-dashed border-[var(--border)] rounded transition-all">
                  <Shield size={14} className="shrink-0 text-[var(--accent)] mt-0.5" />
                  <span>{getLevelCaption(workspaceAI.level)}</span>
                </div>
              </div>

              {/* AI Connection Cards - Only when Level >= 1 */}
              {workspaceAI.level >= 1 ? (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-75">AI Connection Services</label>
                    <div className="text-[10px] opacity-50">Credentials stay on this device. Connections are browser-direct.</div>
                  </div>

                  <div className="space-y-3">

                    {/* 1. OpenAI Card */}
                    <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--sidebar-bg)]/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${isReady('openai') ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                          <div className="font-semibold text-xs flex flex-col gap-0.5">
                            <span className="text-sm">OpenAI</span>
                            <span className="text-[10px] opacity-55 font-normal">
                              {isReady('openai') ? 'API key configured' : 'Not configured'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isReady('openai') && (
                            <button
                              onClick={() => triggerConnectionTest('openai')}
                              className="px-3 py-1.5 text-[10px] rounded border border-[var(--border)] bg-white dark:bg-[#1a1a19] hover:bg-[var(--border)]/35 text-[var(--foreground)] font-semibold cursor-pointer"
                            >
                              Test Connection
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleProvider('openai')}
                            className="px-3.5 py-1.5 bg-[var(--border)] hover:bg-[var(--border)]/70 text-[var(--foreground)] font-semibold text-[10px] cursor-pointer rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleProvider('openai')}
                            className="p-1.5 hover:bg-[var(--border)]/40 rounded shrink-0 transition-colors"
                          >
                            {expandedProvider === 'openai' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </div>
                      </div>

                      {expandedProvider === 'openai' && (
                        <div className="pt-4 border-t border-[var(--border)] space-y-4 animate-fade-in">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="col-span-2">
                              <label className="block text-[9px] font-bold uppercase opacity-60 mb-1">OpenAI API Key</label>
                              <input
                                type="password"
                                value={workspaceAI.providers.openai?.apiKey || ''}
                                onChange={(e) => updateProviderConfig('openai', { apiKey: e.target.value })}
                                placeholder="sk-..."
                                className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--background)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] rounded"
                              />
                            </div>

                            <div className="col-span-2 space-y-1.5">
                              <label className="block text-[9px] font-bold uppercase opacity-60">Default Model</label>
                              <input
                                type="text"
                                value={workspaceAI.providers.openai?.defaultModel || ''}
                                onChange={(e) => updateProviderConfig('openai', { defaultModel: e.target.value })}
                                placeholder="e.g. gpt-4o-mini, gpt-4o"
                                className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] rounded"
                              />
                            </div>
                          </div>

                          {renderTestResultRow('openai')}
                        </div>
                      )}
                    </div>

                    {/* 2. Claude Card */}
                    <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--sidebar-bg)]/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${isReady('anthropic') ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                          <div className="font-semibold text-xs flex flex-col gap-0.5">
                            <span className="text-sm">Claude (Anthropic)</span>
                            <span className="text-[10px] opacity-55 font-normal">
                              {isReady('anthropic') ? 'API key configured' : 'Not configured'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isReady('anthropic') && (
                            <button
                              onClick={() => triggerConnectionTest('anthropic')}
                              className="px-3 py-1.5 text-[10px] rounded border border-[var(--border)] bg-white dark:bg-[#1a1a19] hover:bg-[var(--border)]/35 text-[var(--foreground)] font-semibold cursor-pointer"
                            >
                              Test Connection
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleProvider('anthropic')}
                            className="px-3.5 py-1.5 bg-[var(--border)] hover:bg-[var(--border)]/70 text-[var(--foreground)] font-semibold text-[10px] cursor-pointer rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleProvider('anthropic')}
                            className="p-1.5 hover:bg-[var(--border)]/40 rounded shrink-0 transition-colors"
                          >
                            {expandedProvider === 'anthropic' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </div>
                      </div>

                      {expandedProvider === 'anthropic' && (
                        <div className="pt-4 border-t border-[var(--border)] space-y-4 animate-fade-in">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="col-span-2">
                              <label className="block text-[9px] font-bold uppercase opacity-60 mb-1">Anthropic API Key</label>
                              <input
                                type="password"
                                value={workspaceAI.providers.anthropic?.apiKey || ''}
                                onChange={(e) => updateProviderConfig('anthropic', { apiKey: e.target.value })}
                                placeholder="sk-ant-..."
                                className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--background)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] rounded"
                              />
                            </div>

                            <div className="col-span-2 space-y-1.5">
                              <label className="block text-[9px] font-bold uppercase opacity-60">Default Model</label>
                              <input
                                type="text"
                                value={workspaceAI.providers.anthropic?.defaultModel || ''}
                                onChange={(e) => updateProviderConfig('anthropic', { defaultModel: e.target.value })}
                                placeholder="e.g. claude-3-5-haiku-20241022, claude-3-5-sonnet-20241022"
                                className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] rounded"
                              />
                            </div>
                          </div>

                          {renderTestResultRow('anthropic')}
                        </div>
                      )}
                    </div>

                    {/* 3. OpenRouter Card */}
                    <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--sidebar-bg)]/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${isReady('openrouter') ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                          <div className="font-semibold text-xs flex flex-col gap-0.5">
                            <span className="text-sm">OpenRouter</span>
                            <span className="text-[10px] opacity-55 font-normal">
                              {isReady('openrouter') ? 'API key configured' : 'Not configured'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isReady('openrouter') && (
                            <button
                              onClick={() => triggerConnectionTest('openrouter')}
                              className="px-3 py-1.5 text-[10px] rounded border border-[var(--border)] bg-white dark:bg-[#1a1a19] hover:bg-[var(--border)]/35 text-[var(--foreground)] font-semibold cursor-pointer"
                            >
                              Test Connection
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleProvider('openrouter')}
                            className="px-3.5 py-1.5 bg-[var(--border)] hover:bg-[var(--border)]/70 text-[var(--foreground)] font-semibold text-[10px] cursor-pointer rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleProvider('openrouter')}
                            className="p-1.5 hover:bg-[var(--border)]/40 rounded shrink-0 transition-colors"
                          >
                            {expandedProvider === 'openrouter' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </div>
                      </div>

                      {expandedProvider === 'openrouter' && (
                        <div className="pt-4 border-t border-[var(--border)] space-y-4 animate-fade-in">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="col-span-2">
                              <label className="block text-[9px] font-bold uppercase opacity-60 mb-1">OpenRouter API Key</label>
                              <input
                                type="password"
                                value={workspaceAI.providers.openrouter?.apiKey || ''}
                                onChange={(e) => updateProviderConfig('openrouter', { apiKey: e.target.value })}
                                placeholder="sk-or-..."
                                className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--background)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] rounded"
                              />
                            </div>

                            <div className="col-span-2 space-y-1.5">
                              <label className="block text-[9px] font-bold uppercase opacity-60">Default Model</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={openRouterSearch || workspaceAI.providers.openrouter?.defaultModel || ''}
                                  onChange={(e) => {
                                    setOpenRouterSearch(e.target.value);
                                    updateProviderConfig('openrouter', { defaultModel: e.target.value });
                                  }}
                                  placeholder="Search or enter model ID (e.g. google/gemini-2.5-flash)"
                                  className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] rounded"
                                />
                                {loadingOpenRouterModels && (
                                  <div className="absolute right-3 top-2.5 text-[9px] opacity-50">Loading...</div>
                                )}

                                {openRouterSearch && openRouterModels.length > 0 && (
                                  <div className="absolute left-0 right-0 top-10 z-[70] max-h-48 overflow-y-auto bg-white dark:bg-[#1a1a19] border border-[var(--border)] shadow-lg divide-y divide-[var(--border)] rounded">
                                    {openRouterModels
                                      .filter((m) =>
                                        m.id.toLowerCase().includes(openRouterSearch.toLowerCase()) ||
                                        m.name.toLowerCase().includes(openRouterSearch.toLowerCase())
                                      )
                                      .slice(0, 10)
                                      .map((m) => (
                                        <button
                                          key={m.id}
                                          onClick={() => {
                                            updateProviderConfig('openrouter', { defaultModel: m.id });
                                            setOpenRouterSearch('');
                                          }}
                                          className="w-full text-left px-3 py-2 hover:bg-[var(--border)]/40 text-[10px] flex items-center justify-between cursor-pointer"
                                        >
                                          <div className="flex flex-col">
                                            <span className="font-semibold">{m.name}</span>
                                            <span className="opacity-50 text-[8px]">{m.id}</span>
                                          </div>
                                          <div className="text-right opacity-60 text-[8px]">
                                            <div>P: ${m.promptPrice.toFixed(2)}/1M</div>
                                            <div>C: ${m.completionPrice.toFixed(2)}/1M</div>
                                          </div>
                                        </button>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {renderTestResultRow('openrouter')}
                        </div>
                      )}
                    </div>

                    {/* 4. Local AI Card */}
                    <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--sidebar-bg)]/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2.5 h-2.5 rounded-full ${isReady('local') ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                          <div className="font-semibold text-xs flex flex-col gap-0.5">
                            <span className="text-sm">Local AI</span>
                            <span className="text-[10px] opacity-55 font-normal">
                              {isReady('local') ? `${workspaceAI.providers.local?.defaultModel} @ Local` : 'Not configured'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isReady('local') && (
                            <button
                              onClick={() => triggerConnectionTest('local')}
                              className="px-3 py-1.5 text-[10px] rounded border border-[var(--border)] bg-white dark:bg-[#1a1a19] hover:bg-[var(--border)]/35 text-[var(--foreground)] font-semibold cursor-pointer"
                            >
                              Test Connection
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleProvider('local')}
                            className="px-3.5 py-1.5 bg-[var(--border)] hover:bg-[var(--border)]/70 text-[var(--foreground)] font-semibold text-[10px] cursor-pointer rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleProvider('local')}
                            className="p-1.5 hover:bg-[var(--border)]/40 rounded shrink-0 transition-colors"
                          >
                            {expandedProvider === 'local' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </div>
                      </div>

                      {expandedProvider === 'local' && (
                        <div className="pt-4 border-t border-[var(--border)] space-y-4 animate-fade-in">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            
                            <div className="col-span-2 space-y-1">
                              <label className="block text-[9px] font-bold uppercase opacity-60">Base URL</label>
                              <input
                                type="text"
                                value={workspaceAI.providers.local?.baseUrl || ''}
                                onChange={(e) => {
                                  updateProviderConfig('local', { baseUrl: e.target.value });
                                  setLocalUrlCorrection(null);
                                }}
                                onBlur={(e) => handleLocalBaseUrlBlur(e.target.value)}
                                placeholder="http://localhost:11434/v1"
                                className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] font-mono rounded"
                              />
                              {localUrlError && (
                                <div className="text-[10px] text-red-500 font-medium">{localUrlError}</div>
                              )}
                              {localUrlCorrection && (
                                <button
                                  onClick={() => {
                                    updateProviderConfig('local', { baseUrl: localUrlCorrection });
                                    setLocalUrlCorrection(null);
                                    setLocalUrlError(null);
                                  }}
                                  className="text-[10px] text-[var(--accent)] hover:underline font-medium text-left flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                                >
                                  <span>Auto-correct to <code>{localUrlCorrection}</code>?</span>
                                  <ArrowRight size={11} />
                                </button>
                              )}
                            </div>

                            <div className="col-span-2">
                              <label className="block text-[9px] font-bold uppercase opacity-60 mb-1">API Key (Optional)</label>
                              <input
                                type="password"
                                value={workspaceAI.providers.local?.apiKey || ''}
                                onChange={(e) => updateProviderConfig('local', { apiKey: e.target.value })}
                                placeholder="Optional bearer token"
                                className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--background)] text-xs font-mono text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] rounded"
                              />
                            </div>

                            <div className="col-span-2">
                              <label className="block text-[9px] font-bold uppercase opacity-60 mb-1">Model ID</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={workspaceAI.providers.local?.defaultModel || ''}
                                  onChange={(e) => updateProviderConfig('local', { defaultModel: e.target.value })}
                                  placeholder="e.g. llama3.1:8b"
                                  className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] rounded"
                                />
                                {loadingLocalModels && (
                                  <div className="absolute right-3 top-2.5 text-[9px] opacity-50">Loading...</div>
                                )}

                                {localModels.length > 0 && (
                                  <div className="absolute left-0 right-0 top-10 z-[70] max-h-48 overflow-y-auto bg-white dark:bg-[#1a1a19] border border-[var(--border)] shadow-lg divide-y divide-[var(--border)] rounded">
                                    {localModels.map((m) => (
                                      <button
                                        key={m}
                                        onClick={() => {
                                          updateProviderConfig('local', { defaultModel: m });
                                          setLocalModels([]);
                                        }}
                                        className="w-full text-left px-3 py-2 hover:bg-[var(--border)]/40 text-[10px] font-mono text-[var(--foreground)] cursor-pointer"
                                      >
                                        {m}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="col-span-2">
                              <button
                                onClick={() => setShowAdvancedLocal(!showAdvancedLocal)}
                                className="text-[10px] font-semibold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                              >
                                <span>Advanced custom headers</span>
                                {showAdvancedLocal ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </button>

                              {showAdvancedLocal && (
                                <div className="mt-2.5 p-3 bg-[var(--background)] border border-[var(--border)] space-y-2 animate-fade-in rounded">
                                  <label className="block text-[9px] font-bold uppercase opacity-65">Headers JSON</label>
                                  <textarea
                                    value={workspaceAI.providers.local?.headers ? JSON.stringify(workspaceAI.providers.local.headers, null, 2) : ''}
                                    onChange={(e) => {
                                      try {
                                        const parsed = e.target.value.trim() ? JSON.parse(e.target.value) : undefined;
                                        updateProviderConfig('local', { headers: parsed });
                                      } catch {
                                        // ignore invalid JSON
                                      }
                                    }}
                                    placeholder='{ "X-Auth-Header": "SecretVal" }'
                                    className="w-full h-16 px-3 py-2 bg-transparent border border-[var(--border)] font-mono text-[10px] text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] resize-none rounded"
                                  />
                                </div>
                              )}
                            </div>

                          </div>

                          {renderTestResultRow('local')}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Default Provider Picker */}
                  {readyProvidersList.length > 0 && (
                    <div className="space-y-3 animate-fade-in pt-3 border-t border-[var(--border)]">
                      <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-75">Default AI Provider</label>
                      <div className="grid grid-cols-2 gap-3">
                        {readyProvidersList.map((pid) => {
                          const isSelected = workspaceAI.defaultProviderId === pid;
                          const displayName = pid === 'openai' ? 'OpenAI' : pid === 'anthropic' ? 'Claude' : pid === 'openrouter' ? 'OpenRouter' : 'Local AI';
                          return (
                            <button
                              key={pid}
                              onClick={() => handleDefaultProviderChange(pid)}
                              className={`p-4 border rounded-lg text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                                isSelected
                                  ? 'border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--accent)] shadow-sm font-bold'
                                  : 'border-[var(--border)] bg-[var(--sidebar-bg)]/20 hover:bg-[var(--border)]/45 text-[var(--foreground)]'
                              }`}
                            >
                              <span>{displayName}</span>
                              {isSelected && <CheckCircle2 size={14} className="text-[var(--accent)]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Connection Testing Playground */}
                  {readyProvidersList.length > 0 && (
                    <div className="space-y-4 animate-fade-in pt-6 border-t border-[var(--border)]">
                      <div className="flex items-center gap-2">
                        <Terminal size={15} className="text-[var(--accent)]" />
                        <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-75">
                          Connection Testing Playground
                        </label>
                      </div>
                      <p className="text-[10px] opacity-60">
                        Test custom queries and inspect real-time assistant completions from your active LLM servers.
                      </p>

                      <div className="border border-[var(--border)] rounded-lg p-5 bg-[var(--sidebar-bg)]/20 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          {/* Selector */}
                          <div>
                            <label className="block text-[9px] font-bold uppercase opacity-65 mb-1.5">Select Connection</label>
                            <select
                              value={playgroundProvider}
                              onChange={(e) => setPlaygroundProvider(e.target.value as ProviderId)}
                              className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-xs focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                            >
                              {readyProvidersList.map((pid) => (
                                <option key={pid} value={pid}>
                                  {pid === 'openai' ? 'OpenAI' : pid === 'anthropic' ? 'Claude' : pid === 'openrouter' ? 'OpenRouter' : 'Local AI'}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Model */}
                          <div>
                            <label className="block text-[9px] font-bold uppercase opacity-65 mb-1.5">Model ID</label>
                            <input
                              type="text"
                              value={playgroundModel}
                              onChange={(e) => setPlaygroundModel(e.target.value)}
                              placeholder="e.g. google/gemini-2.5-flash"
                              className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] font-mono"
                            />
                          </div>

                          {/* Prompt */}
                          <div className="col-span-1 md:col-span-2">
                            <label className="block text-[9px] font-bold uppercase opacity-65 mb-1.5">Test Prompt Input</label>
                            <textarea
                              value={playgroundPrompt}
                              onChange={(e) => setPlaygroundPrompt(e.target.value)}
                              rows={3}
                              placeholder="Type a custom prompt to evaluate..."
                              className="w-full px-3 py-2 rounded border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] font-mono resize-none"
                            />
                          </div>

                        </div>

                        {/* Action buttons */}
                        <div className="flex justify-start">
                          <button
                            onClick={handleSendPlaygroundPrompt}
                            disabled={playgroundTesting || !playgroundModel.trim() || !playgroundPrompt.trim()}
                            className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity"
                          >
                            {playgroundTesting ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Send size={13} />
                            )}
                            <span>{playgroundTesting ? 'Sending Query...' : 'Send Test Prompt'}</span>
                          </button>
                        </div>

                        {/* Playground Console Output block */}
                        {playgroundResult && (
                          <div className="space-y-2 animate-fade-in">
                            <label className="block text-[9px] font-bold uppercase opacity-65">Response Terminal Console</label>
                            
                            {playgroundResult.ok ? (
                              <div className="border border-green-500/25 bg-green-500/5 rounded-lg p-4 space-y-3 text-xs select-text">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-green-700 dark:text-green-500 font-semibold border-b border-green-500/20 pb-2">
                                  <div className="flex items-center gap-1.5">
                                    <CheckCircle2 size={13} className="shrink-0" />
                                    <span>Status: Connected</span>
                                  </div>
                                  <div>Latency: {playgroundResult.latencyMs} ms</div>
                                  {playgroundResult.modelTested && (
                                    <div className="font-mono text-[9px]">Model: {playgroundResult.modelTested}</div>
                                  )}
                                </div>
                                <div className="font-mono whitespace-pre-wrap leading-relaxed opacity-90 text-[11px] bg-white/50 dark:bg-black/20 p-3 border border-[var(--border)] rounded">
                                  {playgroundResult.reply}
                                </div>
                              </div>
                            ) : (
                              <div className="border border-red-500/25 bg-red-500/5 rounded-lg p-4 space-y-2 text-xs select-text">
                                <div className="flex items-center gap-1.5 text-red-600 dark:text-red-500 font-semibold border-b border-red-500/20 pb-2 text-[10px]">
                                  <AlertCircle size={13} className="shrink-0" />
                                  <span>Status: Connection Failed</span>
                                </div>
                                <div className="font-mono text-[10px] text-red-600 dark:text-red-400 whitespace-pre-wrap leading-relaxed bg-white/50 dark:bg-black/20 p-3 border border-[var(--border)] rounded">
                                  {playgroundResult.error}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="p-8 border border-dashed border-[var(--border)] rounded-lg text-center text-xs opacity-60">
                  Increase the AI Level to 1 or higher to configure provider connections.
                </div>
              )}

            </div>
          )}

        </div>

      </div>

    </div>
  );

  function renderTestResultRow(pid: ProviderId) {
    const res = testResults[pid];
    if (!res) return null;

    if (res.testing) {
      return (
        <div className="text-[10px] flex items-center gap-1.5 text-[var(--accent)] animate-pulse">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-ping shrink-0" />
          <span>Testing round-trip completion...</span>
        </div>
      );
    }

    if (res.ok) {
      return (
        <div className="p-3 border border-green-500/20 bg-green-500/10 rounded-md space-y-1.5 animate-fade-in text-[10px]">
          <div className="flex items-center gap-1.5 text-green-700 dark:text-green-500 font-semibold">
            <CheckCircle2 size={13} className="shrink-0" />
            <span>Connected · {res.latencyMs} ms</span>
          </div>
          {res.reply && (
            <div className="font-mono text-[9px] opacity-75 border-t border-green-500/20 pt-1.5 select-text truncate">
              <strong>Reply:</strong> &quot;{res.reply}&quot;
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="p-3 border border-red-500/20 bg-red-500/10 rounded-md space-y-1.5 animate-fade-in text-[10px]">
        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-500 font-semibold">
          <AlertCircle size={13} className="shrink-0" />
          <span>Connection Failed</span>
        </div>
        <div className="opacity-80 leading-normal select-text">
          {res.error}
        </div>
        {res.error?.includes('Authentication') && (
          <div className="pt-1 select-none">
            <span className="text-[10px] opacity-60">Re-paste your key above.</span>
          </div>
        )}
      </div>
    );
  }
}
