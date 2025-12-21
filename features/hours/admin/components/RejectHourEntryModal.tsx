"use client";

import { useEffect, useRef } from "react";
import type { AdminHourEntry } from "@/features/hours/admin/types";
import { Button } from "@/components/ui/button";

type Props = {
  entry: AdminHourEntry | null;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function RejectHourEntryModal({
  entry,
  rejectReason,
  setRejectReason,
  saving,
  onClose,
  onConfirm,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!entry) return;

    requestAnimationFrame(() => textareaRef.current?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [entry, saving, onClose]);

  if (!entry) return null;

  const trimmed = rejectReason.trim();
  const canConfirm = !saving && trimmed.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label={`Reject entry ${entry.date}`}
      onMouseDown={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl bg-background p-4 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-lg font-semibold">Reject entry – {entry.date}</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Provide a reason for rejection. The employee will see this.
        </p>

        <label className="mb-1 block text-sm font-medium">Reject reason</label>
        <textarea
          ref={textareaRef}
          className="w-full rounded-md border px-3 py-2 text-sm"
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          disabled={saving}
          placeholder="Explain what needs to be fixed…"
        />

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>

          <Button disabled={!canConfirm} onClick={onConfirm}>
            {saving ? "Rejecting..." : "Reject"}
          </Button>
        </div>
      </div>
    </div>
  );
}
