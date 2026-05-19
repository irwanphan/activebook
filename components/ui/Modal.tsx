"use client";

import { useEffect, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  panelClassName?: string;
};

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  panelClassName = "",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-zinc-950/45 backdrop-blur-[1px]"
        aria-label="Tutup dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-xl shadow-zinc-950/15 ${panelClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 id="modal-title" className="text-base font-semibold tracking-tight text-zinc-900">
            {title}
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
          {children}
        </div>
        {footer ? (
          <div className="border-t border-zinc-100 bg-zinc-50/80 px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
