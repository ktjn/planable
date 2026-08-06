import { useEffect } from 'react';

export interface ShortcutAction {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  target: 'nav' | 'global';
  handler: () => void;
  description: string;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function useKeyboardShortcuts(actions: ShortcutAction[]) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (isTypingTarget(e.target) && e.key !== 'Escape') return;

      const ctrlPressed = e.ctrlKey || e.metaKey;
      for (const action of actions) {
        const wantsCtrl = Boolean(action.ctrl || action.meta);
        if (e.key.toLowerCase() !== action.key) continue;
        if (wantsCtrl !== ctrlPressed) continue;
        e.preventDefault();
        action.handler();
        return;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions]);
}
