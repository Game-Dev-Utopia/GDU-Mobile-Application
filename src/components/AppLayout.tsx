'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';
import ViewAsMenu from './ViewAsMenu';
import PWAInstallPrompt from './ui/PWAInstallPrompt';

interface AppLayoutProps {
  children: React.ReactNode;
  activePath: string;
}

export default function AppLayout({ children, activePath }: AppLayoutProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installPromptOpen, setInstallPromptOpen] = useState(false);

  useEffect(() => {
    // Auto-show install prompt once per user
    const alreadyDismissed = localStorage.getItem('gduxp:pwa-dismissed') === '1';
    if (alreadyDismissed) return;

    function handler(e: BeforeInstallPromptEvent) {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show the install prompt after a short delay
      setTimeout(() => setInstallPromptOpen(true), 2500);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(() => {
    deferredPrompt?.prompt();
    deferredPrompt?.userChoice().then(() => {
      setDeferredPrompt(null);
      setInstallPromptOpen(false);
      localStorage.setItem('gduxp:pwa-dismissed', '1');
    });
  }, [deferredPrompt]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Skip link for keyboard navigation */}
      <a
        href="#main-content"
        className="skip-link"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <Sidebar activePath={activePath} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
        <main id="main-content" className="flex-1 pb-20 lg:pb-0 overflow-y-auto scrollbar-thin">
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar activePath={activePath} />

      {/* PWA install prompt */}
      <PWAInstallPrompt
        open={!!deferredPrompt && installPromptOpen}
        onClose={() => setInstallPromptOpen(false)}
        onInstall={handleInstall}
      />

      {/* Dev-only View As Menu */}
      <ViewAsMenu />
    </div>
  );
}
