import type { HourStatusUi } from "@/features/hours/admin/types";

type PatchHourInput = Partial<{
    description: string;
    status: "APPROVED" | "REJECTED" | "PENDING";
}>;

async function safeJson(res: Response) {
    const text = await res.text();
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
    const res = await fetch(url, init);
    if (!res.ok) {
        const msg = await res.text();
        return { ok: false, error: msg || `HTTP ${res.status}` };
    }
    const data = (await safeJson(res)) as T;
    return { ok: true, data };
}

export async function approveHourEntry(id: number) {
    return requestJson<{ status?: string }>(`/api/admin/hours/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
    });
}

export async function rejectHourEntry(id: number, rejectReason: string) {
    return requestJson<{ status?: string }>(`/api/admin/hours/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            status: "REJECTED",
            rejectReason,
        }),
    });
}


export async function updateHourEntry(id: number, patch: PatchHourInput) {
    return requestJson<{ description?: string; status?: string }>(`/api/admin/hours/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
    });
}

// Helper for UI normalization (keeps UI strict even if backend varies)
export function normalizeStatus(status: unknown): HourStatusUi {
    const s = String(status ?? "").trim().toLowerCase();

    if (s === "approved") return "approved";
    if (s === "rejected") return "rejected";

    // accept backend variants
    if (s === "pending-employee" || s === "pending_employee" || s === "pendingemployee") {
        return "pendingEmployee";
    }

    return "pending";
}

