'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';

interface PWAInstallPromptProps {
  open: boolean;
  onClose: () => void;
  onInstall: () => void;
}

export default function PWAInstallPrompt({
  open,
  onClose,
  onInstall,
}: PWAInstallPromptProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleInstall = useCallback(() => {
    onInstall();
    onClose();
  }, [onInstall, onClose]);

  if (!open || dismissed) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between px-4 py-3 rounded-2xl bg-card border border-border shadow-card"
      role="alert"
      aria-label="Install app"
    >
      <div className="flex flex-col items-start gap-1">
        <h3 className="font-heading font-bold text-foreground text-sm">Install GDU XP</h3>
        <p className="text-xs text-muted-foreground">
          Add GDU XP to your home screen for faster access and offline use.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Download size={16} className="text-accent" />
        <button
          onClick={handleInstall}
          className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150"
        >
          Install
        </button>
        <button
          onClick={() => {
            setDismissed(true);
            onClose();
          }}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors duration-150"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
