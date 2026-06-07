'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

interface FlashPageProps {
  onDismiss: () => void;
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

export default function FlashPage({ onDismiss }: FlashPageProps) {
  const { lang } = useTranslation();
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Auto-increment progress bar for a premium loading feel
  useEffect(() => {
    const duration = 1200; // 1.2s total loading time
    const intervalTime = 20;
    const increment = 100 / (duration / intervalTime);

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(timer);
          setIsReady(true);
          return 100;
        }
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, []);

  const slogan = lang === 'vi' 
    ? 'Viết tiểu thuyết ngay trên máy của bạn. Sở hữu từng con chữ. Không phí thuê bao.'
    : 'Write your novel on your own machine. Own every word. Pay no subscription.';

  const enterText = lang === 'vi' ? 'Bắt đầu viết' : 'Enter Workspace';

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gradient-to-br from-[#0c0c0d] via-[#141416] to-[#0a0a0b] text-white select-none overflow-hidden font-sans">
      {/* Decorative Radial glow behind */}
      <div 
        className="absolute w-[500px] h-[500px] rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-1000"
        style={{
          background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
          transform: 'translate(-50%, -50%)',
          left: '50%',
          top: '45%',
          animation: 'pulse 6s infinite alternate'
        }}
      />

      <div className="relative z-10 max-w-md w-full px-6 flex flex-col items-center text-center space-y-8 animate-fade-in">
        {/* App Logo */}
        <div className="relative group">
          <div className="absolute -inset-1.5 bg-gradient-to-r from-[var(--accent)] to-[#a855f7] rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
          <div className="relative bg-[#1a1a1e] p-4 rounded-3xl border border-white/5 shadow-2xl flex items-center justify-center">
            <img 
              src="logo.png" 
              alt="XNovelist Logo" 
              className="h-20 w-20 object-contain drop-shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)] animate-float"
              onError={(e) => {
                // Fallback to Lucide if image fails
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const fallback = document.createElement('div');
                  fallback.className = 'h-20 w-20 flex items-center justify-center text-[var(--accent)]';
                  fallback.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/><path d="M8 14h8"/><path d="M6 18h10"/></svg>`;
                  parent.appendChild(fallback);
                }
              }}
            />
          </div>
        </div>

        {/* Title & Slogan */}
        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold tracking-widest bg-gradient-to-r from-white via-neutral-200 to-neutral-400 bg-clip-text text-transparent uppercase">
            XNovelist
          </h1>
          <p className="text-xs text-neutral-400 font-medium tracking-wide uppercase max-w-xs mx-auto opacity-75">
            Local-First · AI-Optional
          </p>
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent mx-auto my-2" />
          <p className="text-sm text-neutral-300 leading-relaxed font-serif italic max-w-sm px-2">
            &ldquo;{slogan}&rdquo;
          </p>
        </div>

        {/* Dynamic Loading or Action area */}
        <div className="w-full h-12 flex items-center justify-center">
          {!isReady ? (
            <div className="w-48 space-y-2">
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[var(--accent)] to-[#a855f7] transition-all duration-75 ease-out rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-[9px] text-neutral-500 uppercase tracking-widest font-mono">
                Initializing storage
              </div>
            </div>
          ) : (
            <button
              onClick={onDismiss}
              className="group flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[var(--accent)] to-[#9333ea] text-white hover:opacity-95 font-semibold rounded-full text-xs transition-all shadow-lg shadow-[var(--accent)]/10 cursor-pointer border border-white/10 scale-100 hover:scale-105 active:scale-95"
            >
              <span>{enterText}</span>
              <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
            </button>
          )}
        </div>

        {/* GitHub Badge */}
        <div className="pt-4 animate-fade-in-delayed">
          <a
            href="https://github.com/giapnguyen74/xnovelist"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-neutral-400 hover:text-white transition-all cursor-pointer"
          >
            <GithubIcon size={12} className="opacity-80" />
            <span className="font-mono">github.com/giapnguyen74/xnovelist</span>
          </a>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0% { opacity: 0.15; transform: translate(-50%, -50%) scale(0.95); }
          100% { opacity: 0.25; transform: translate(-50%, -50%) scale(1.05); }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-fade-in {
          animation: fadeIn 0.8s ease-out forwards;
        }
        .animate-fade-in-delayed {
          animation: fadeIn 1.2s ease-out forwards;
          opacity: 0;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
