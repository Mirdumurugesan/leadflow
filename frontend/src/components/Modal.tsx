"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headerExtra?: ReactNode;
  widthClass?: string;
  labelledBy: string;
}

/** Accessible dialog: Esc and backdrop close, focus moves in and is restored on close. */
export function Modal({ title, onClose, children, footer, headerExtra, widthClass = "max-w-md", labelledBy }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the mount effect (which would steal focus).
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus], input, textarea, select, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`relative flex max-h-[90vh] w-full ${widthClass} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div id={labelledBy} className="min-w-0">{title}</div>
          <div className="flex items-center gap-2">
            {headerExtra}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
                <path fill="currentColor" d="M5.3 4.2a.75.75 0 0 0-1.1 1.1L8.94 10l-4.72 4.7a.75.75 0 1 0 1.06 1.06L10 11.06l4.7 4.72a.75.75 0 1 0 1.06-1.06L11.06 10l4.72-4.7a.75.75 0 0 0-1.06-1.06L10 8.94 5.3 4.2Z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-slate-200 bg-white px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
