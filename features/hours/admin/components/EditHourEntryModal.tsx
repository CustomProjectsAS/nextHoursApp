"use client";

import { useEffect, useRef } from "react";
import type { AdminHourEntry } from "@/features/hours/admin/types";
import { Button } from "@/components/ui/button";

type Props = {
    entry: AdminHourEntry | null;
    description: string;
    setDescription: (v: string) => void;
    saving: boolean;
    onClose: () => void;
    onSave: () => Promise<void>;
};

export function EditHourEntryModal({
    entry,
    description,
    setDescription,
    saving,
    onClose,
    onSave,
}: Props) {
    const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        if (!entry) return;

        requestAnimationFrame(() => editTextareaRef.current?.focus());

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !saving) onClose();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [entry, saving, onClose]);

    if (!entry) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            role="dialog"
            aria-modal="true"
            aria-label={`Edit entry ${entry.date}`}
            onMouseDown={() => !saving && onClose()}
        >
            <div
                className="w-full max-w-md rounded-xl bg-background p-4 shadow-lg"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <h3 className="mb-3 text-lg font-semibold">Edit entry – {entry.date}</h3>

                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                    ref={editTextareaRef}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={saving}
                />

                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>

                    <Button
                        disabled={saving}
                        onClick={async () => {
                            await onSave();
                        }}
                    >
                        {saving ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
