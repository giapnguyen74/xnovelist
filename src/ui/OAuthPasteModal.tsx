import React, { useState, useEffect } from 'react';
import { ExternalLink, Copy, Check, Loader2 } from 'lucide-react';

interface OAuthPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerName: string;
  authUrl: string;
  onConnect: (pastedText: string) => Promise<void>;
}

export default function OAuthPasteModal({
  isOpen,
  onClose,
  providerName,
  authUrl,
  onConnect,
}: OAuthPasteModalProps) {
  const [pastedText, setPastedText] = useState('');
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOpenAuth = () => {
    window.open(authUrl, '_blank');
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(authUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleConnect = async () => {
    if (!pastedText.trim()) {
      setError('Please paste the redirect URL or authorization code parameter.');
      return;
    }

    setError(null);
    setConnecting(true);

    try {
      await onConnect(pastedText.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to establish connection. Please check your pasted URL.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] select-none animate-fade-in">
      <div className="bg-white dark:bg-[#1e1e1d] border border-[var(--border)] rounded-none max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-[var(--foreground)]">
        <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider">
            Sign in with {providerName}
          </h3>
          <button
            onClick={onClose}
            className="text-sm opacity-50 hover:opacity-100 font-bold"
            disabled={connecting}
          >
            ✕
          </button>
        </div>

        {/* 1. Instructions */}
        <div className="space-y-1.5 text-xs opacity-90">
          <div className="font-semibold text-[10px] uppercase tracking-widest opacity-60">Instructions</div>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Click <strong>'Open authorisation page'</strong>.</li>
            <li>Approve access in the new tab.</li>
            <li>Your browser will redirect to a page that fails to load (this is expected).</li>
            <li>Copy the full URL from your browser's address bar and paste it below.</li>
          </ol>
        </div>

        {/* 2. Open / Fallback */}
        <div className="flex flex-col gap-2 p-3 bg-[var(--sidebar-bg)] border border-[var(--border)]">
          <button
            onClick={handleOpenAuth}
            className="w-full py-2 px-4 rounded-none bg-[var(--accent)] text-white hover:opacity-90 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ExternalLink size={13} />
            Open authorisation page
          </button>
          
          <div className="text-[10px] opacity-65 flex flex-col gap-1 mt-1">
            <span>Or copy this URL if your browser blocked the new tab:</span>
            <div className="flex items-center gap-1.5 bg-white dark:bg-[#1a1a19] border border-[var(--border)] p-1.5 select-all">
              <span className="font-mono truncate flex-1 text-[9px]">{authUrl}</span>
              <button
                onClick={handleCopyUrl}
                className="p-1 hover:bg-[var(--border)] border border-transparent rounded shrink-0 transition-colors"
                title="Copy URL"
              >
                {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Paste Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-65">
            Paste the redirect URL (or just the code=... parameter)
          </label>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="http://localhost:1455/auth/callback?code=...&state=..."
            className="w-full h-16 px-3 py-2 text-xs rounded-none border border-[var(--border)] bg-transparent text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] resize-none font-mono"
            disabled={connecting}
          />
        </div>

        {error && (
          <div className="text-[10px] text-red-500 font-medium bg-red-500/10 border border-red-500/20 px-3 py-2">
            {error}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="text-[10px] underline font-medium hover:text-[var(--accent)] cursor-pointer"
            disabled={connecting}
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={connecting || !pastedText.trim()}
            className="px-5 py-2 text-xs font-semibold rounded-none bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-55 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {connecting && <Loader2 size={12} className="animate-spin" />}
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}
