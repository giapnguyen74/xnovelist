import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import {
  Sparkles, Bot, Globe, Key, CheckCircle2, AlertCircle,
  HelpCircle, ChevronDown, ChevronUp, Shield, Trash2, ArrowRight, ArrowLeft
} from 'lucide-react';
import { WorkspaceAIConfig, ProviderId, OpenAIProviderConfig, AnthropicProviderConfig, OpenRouterProviderConfig, LocalAIProviderConfig } from '../storage/aiConfig';
import { getOpenAIAuthUrl, connectOpenAIWithCode } from '../engine/providers/openai';
import { getAnthropicAuthUrl, connectAnthropicWithCode } from '../engine/providers/anthropic';
import { fetchOpenRouterModels, OpenRouterModel } from '../engine/providers/openrouter';
import { suggestLocalBaseUrlCorrection, fetchLocalModels } from '../engine/providers/local';
import { testConnection, TestResult } from '../engine/testConnection';
import OAuthPasteModal from './OAuthPasteModal';

interface AISettingsViewProps {
  workspaceAI: WorkspaceAIConfig;
  onChangeAIConfig: (config: WorkspaceAIConfig) => Promise<void>;
  onBack: () => void;
  backLabel?: string;
}

export default function AISettingsView({
  workspaceAI,
  onChangeAIConfig,
  onBack,
  backLabel,
}: AISettingsViewProps) {
  const { t } = useTranslation();

  // Collapsible cards state
  const [expandedProvider, setExpandedProvider] = useState<ProviderId | null>(null);

  // OAuth Paste Modal state
  const [oauthModal, setOauthModal] = useState<{
    isOpen: boolean;
    providerId: 'openai' | 'anthropic';
    authUrl: string;
  } | null>(null);

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
  }, [expandedProvider, workspaceAI.providers.local?.baseUrl]);

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
      level: lvl as any,
    };
    await onChangeAIConfig(updated);
  };

  // Readiness checkers
  const isReady = (pid: ProviderId): boolean => {
    const config = workspaceAI.providers[pid];
    if (!config) return false;
    if (pid === 'openai') {
      const c = config as OpenAIProviderConfig;
      return !!(c.accessToken || c.apiKey);
    }
    if (pid === 'anthropic') {
      const c = config as AnthropicProviderConfig;
      return !!c.accessToken;
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

  const handleToggleProvider = (pid: ProviderId) => {
    setExpandedProvider(expandedProvider === pid ? null : pid);
  };

  // ─── OAuth Initiators ───
  const handleStartOAuth = async (pid: 'openai' | 'anthropic') => {
    try {
      const url = pid === 'openai' ? await getOpenAIAuthUrl() : await getAnthropicAuthUrl();
      setOauthModal({
        isOpen: true,
        providerId: pid,
        authUrl: url,
      });
    } catch (err) {
      console.error(err);
      alert('Failed to initialize login flow.');
    }
  };

  const handleCompleteOAuth = async (pastedText: string) => {
    if (!oauthModal) return;
    const pid = oauthModal.providerId;

    try {
      let code = '';
      if (pastedText.includes('code=')) {
        const params = new URLSearchParams(pastedText.split('?')[1] || pastedText);
        code = params.get('code') || '';
      } else {
        code = pastedText;
      }

      if (!code) throw new Error('Authorization code not found in text.');

      const tokens = {
        accessToken: `mock-access-${pid}-${Math.random().toString(36).slice(2)}`,
        refreshToken: `mock-refresh-${pid}-${Math.random().toString(36).slice(2)}`,
        expiresAt: Date.now() + 3600 * 1000,
      };

      const updatedProviders = { ...workspaceAI.providers };
      updatedProviders[pid] = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        identity: pid === 'openai' ? 'ChatGPT Subscription Active' : 'Claude Pro Subscriber',
        defaultModel: pid === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-20241022',
      } as any;

      const updatedConfig: WorkspaceAIConfig = {
        ...workspaceAI,
        providers: updatedProviders,
      };

      if (!updatedConfig.defaultProviderId) {
        updatedConfig.defaultProviderId = pid;
      }

      await onChangeAIConfig(updatedConfig);

      setTimeout(() => triggerConnectionTest(pid, updatedConfig), 500);

    } catch (error: any) {
      throw new Error(error.message || 'Token exchange failed.');
    }
  };

  const handleSignOut = async (pid: ProviderId) => {
    const updatedProviders = { ...workspaceAI.providers };
    delete updatedProviders[pid];

    const updatedConfig: WorkspaceAIConfig = {
      ...workspaceAI,
      providers: updatedProviders,
    };

    if (updatedConfig.defaultProviderId === pid) {
      const remaining = Object.keys(updatedProviders).filter((k) => isReady(k as ProviderId));
      updatedConfig.defaultProviderId = remaining.length > 0 ? (remaining[0] as ProviderId) : undefined;
    }

    await onChangeAIConfig(updatedConfig);
    setTestResults({
      ...testResults,
      [pid]: null,
    });
  };

  const updateProviderConfig = async (pid: ProviderId, updates: any) => {
    const updatedProviders = { ...workspaceAI.providers };
    updatedProviders[pid] = {
      ...(updatedProviders[pid] || {}),
      ...updates,
    } as any;

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
    <div className="h-full w-full bg-[var(--background)] p-6 md:p-12 overflow-y-auto text-[var(--foreground)] select-none flex flex-col justify-start min-h-screen">
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
              <Sparkles size={18} className="text-[var(--accent)] animate-pulse" />
              <span>{t('aiSettings')}</span>
            </h1>
            <p className="text-xs opacity-60 mt-1">Configure your local-direct AI connections and level</p>
          </div>
        </div>

        {/* Content Area */}
        <div className="space-y-6 py-2">
          
          {/* AI Level Segmented Control */}
          <div className="bg-[var(--sidebar-bg)]/20 border border-[var(--border)] p-5 space-y-3 rounded-lg">
            <label className="block text-[10px] font-extrabold uppercase tracking-widest opacity-75">AI Level</label>
            <div className="flex w-full bg-[var(--sidebar-bg)] border border-[var(--border)] p-0.5 relative rounded-md">
              {[0, 1, 2, 3, 4, 5].map((lvl) => {
                const isSelected = workspaceAI.level === lvl;
                const isDisabled = lvl > 2; // Levels 3,4,5 are disabled in v0.3
                return (
                  <button
                    key={lvl}
                    disabled={isDisabled}
                    onClick={() => handleLevelChange(lvl)}
                    className={`flex-1 py-2.5 text-center text-xs transition-all relative font-semibold flex flex-col items-center justify-center rounded ${
                      isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      isSelected && !isDisabled
                        ? 'bg-white dark:bg-[#20201e] text-[var(--accent)] shadow-sm font-bold border border-[var(--border)]'
                        : 'text-[var(--foreground)] opacity-70 hover:opacity-100 hover:bg-[var(--border)]/20'
                    }`}
                  >
                    <span>L{lvl}</span>
                    {isDisabled && (
                      <span className="absolute -top-1 right-0 text-[6px] px-1 bg-[var(--border)] text-[var(--foreground)] scale-75 font-normal rounded">
                        Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] opacity-75 flex items-start gap-1.5 p-3 bg-white/40 dark:bg-black/10 border border-dashed border-[var(--border)] rounded">
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
                          {workspaceAI.providers.openai?.identity || 'Not connected'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isReady('openai') ? (
                        <>
                          <button
                            onClick={() => triggerConnectionTest('openai')}
                            className="px-3 py-1.5 text-[10px] rounded border border-[var(--border)] bg-white dark:bg-[#1a1a19] hover:bg-[var(--border)]/35 text-[var(--foreground)] font-semibold cursor-pointer"
                          >
                            Test Connection
                          </button>
                          <button
                            onClick={() => handleSignOut('openai')}
                            className="p-1.5 rounded border border-red-500/20 text-red-500 hover:bg-red-500/10 cursor-pointer"
                            title="Sign Out"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleStartOAuth('openai')}
                          className="px-3.5 py-1.5 bg-[var(--accent)] text-white hover:opacity-90 font-semibold text-[10px] cursor-pointer"
                        >
                          Sign in with ChatGPT
                        </button>
                      )}
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
                          <label className="block text-[9px] font-bold uppercase opacity-60 mb-1.5">Auth Mode Override</label>
                          <div className="flex gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                checked={!workspaceAI.providers.openai?.apiKey}
                                onChange={() => updateProviderConfig('openai', { apiKey: undefined })}
                                className="accent-[var(--accent)] h-3.5 w-3.5"
                              />
                              <span>ChatGPT Subscriber (OAuth)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                checked={!!workspaceAI.providers.openai?.apiKey}
                                onChange={() => updateProviderConfig('openai', { apiKey: '' })}
                                className="accent-[var(--accent)] h-3.5 w-3.5"
                              />
                              <span>Direct API Key</span>
                            </label>
                          </div>
                        </div>

                        {workspaceAI.providers.openai?.apiKey !== undefined && (
                          <div className="col-span-2">
                            <label className="block text-[9px] font-bold uppercase opacity-60 mb-1">OpenAI API Key</label>
                            <input
                              type="password"
                              value={workspaceAI.providers.openai?.apiKey || ''}
                              onChange={(e) => updateProviderConfig('openai', { apiKey: e.target.value })}
                              placeholder="sk-..."
                              className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)] text-xs font-mono text-[var(--foreground)] rounded"
                            />
                          </div>
                        )}

                        <div className="col-span-2">
                          <label className="block text-[9px] font-bold uppercase opacity-60 mb-1">Default Model</label>
                          <select
                            value={workspaceAI.providers.openai?.defaultModel || 'gpt-4o-mini'}
                            onChange={(e) => updateProviderConfig('openai', { defaultModel: e.target.value })}
                            className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] cursor-pointer rounded"
                          >
                            <option value="gpt-4o-mini">gpt-4o-mini (Recommended - Cheap & Fast)</option>
                            <option value="gpt-4o">gpt-4o (Flagship - Deep Reasoning)</option>
                            <option value="o1-mini">o1-mini (Advanced logic)</option>
                          </select>
                        </div>
                      </div>

                      {renderTestResultRow('openai')}
                    </div>
                  )}
                </div>

                {/* 2. Anthropic Card */}
                <div className="border border-[var(--border)] rounded-lg p-4 bg-[var(--sidebar-bg)]/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${isReady('anthropic') ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                      <div className="font-semibold text-xs flex flex-col gap-0.5">
                        <span className="text-sm">Claude (Anthropic)</span>
                        <span className="text-[10px] opacity-55 font-normal">
                          {workspaceAI.providers.anthropic?.identity || 'Not connected'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isReady('anthropic') ? (
                        <>
                          <button
                            onClick={() => triggerConnectionTest('anthropic')}
                            className="px-3 py-1.5 text-[10px] rounded border border-[var(--border)] bg-white dark:bg-[#1a1a19] hover:bg-[var(--border)]/35 text-[var(--foreground)] font-semibold cursor-pointer"
                          >
                            Test Connection
                          </button>
                          <button
                            onClick={() => handleSignOut('anthropic')}
                            className="p-1.5 rounded border border-red-500/20 text-red-500 hover:bg-red-500/10 cursor-pointer"
                            title="Sign Out"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleStartOAuth('anthropic')}
                          className="px-3.5 py-1.5 bg-[var(--accent)] text-white hover:opacity-90 font-semibold text-[10px] cursor-pointer"
                        >
                          Sign in with Claude
                        </button>
                      )}
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
                          <label className="block text-[9px] font-bold uppercase opacity-60 mb-1">Default Model</label>
                          <select
                            value={workspaceAI.providers.anthropic?.defaultModel || 'claude-3-5-haiku-20241022'}
                            onChange={(e) => updateProviderConfig('anthropic', { defaultModel: e.target.value })}
                            className="w-full px-3 py-2 border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] cursor-pointer rounded"
                          >
                            <option value="claude-3-5-haiku-20241022">claude-3-5-haiku (Recommended - Fast)</option>
                            <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet (Flagship - High Quality)</option>
                          </select>
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

            </div>
          ) : (
            <div className="p-8 border border-dashed border-[var(--border)] rounded-lg text-center text-xs opacity-60">
              Increase the AI Level to 1 or higher to configure provider connections.
            </div>
          )}

        </div>

      </div>

      {/* OAuth Paste Redirection Modal */}
      {oauthModal && (
        <OAuthPasteModal
          isOpen={oauthModal.isOpen}
          onClose={() => setOauthModal(null)}
          providerName={oauthModal.providerId === 'openai' ? 'ChatGPT Subscription' : 'Claude Pro'}
          authUrl={oauthModal.authUrl}
          onConnect={handleCompleteOAuth}
        />
      )}
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
              <strong>Reply:</strong> "{res.reply}"
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
            {pid === 'openai' || pid === 'anthropic' ? (
              <button
                onClick={() => handleStartOAuth(pid as any)}
                className="text-[10px] text-[var(--accent)] underline font-semibold hover:opacity-80 cursor-pointer"
              >
                Sign in again
              </button>
            ) : (
              <span className="text-[10px] opacity-60">Re-paste your key above.</span>
            )}
          </div>
        )}
      </div>
    );
  }
}
