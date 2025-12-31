"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRequireAuth } from "@/lib/useRouteGuard";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";


type HourStatus = "PENDING" | "APPROVED" | "REJECTED";
type ApiEntry = any;

function monthISO(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

function toErrorMessage(payload: any, fallback: string) {
    return payload?.error?.message ?? fallback;
}


function normalizeEntries(payload: any): ApiEntry[] {
    const list = payload?.data?.entries;
    return Array.isArray(list) ? list : [];
}


function pick(entry: ApiEntry, keys: string[], fallback: any = "") {
    for (const k of keys) {
        const v = entry?.[k];
        if (v !== undefined && v !== null) return v;
    }
    return fallback;
}

export default function AdminHoursPage() {
    const { loading } = useRequireAuth({ redirectTo: "/login" });

    const [month, setMonth] = useState<string>(() => monthISO());
    const [status, setStatus] = useState<"PENDING" | "REJECTED" | "ALL">("PENDING");

    const [entries, setEntries] = useState<ApiEntry[]>([]);
    const [busy, setBusy] = useState(false);
    const [fatal, setFatal] = useState<string | null>(null);

    const [actionBusyId, setActionBusyId] = useState<number | null>(null);

    async function load() {
        setBusy(true);
        setFatal(null);

        try {
            const fetchOne = async (st: "PENDING" | "APPROVED" | "REJECTED") => {
                const qs = new URLSearchParams();
                qs.set("month", month);
                qs.set("status", st);

                const res = await fetch(`/api/admin/hours?${qs.toString()}`, { cache: "no-store" });
                const payload = await res.json();
                if (!payload?.ok) throw payload;
                return normalizeEntries(payload);

            };

            let list: ApiEntry[] = [];

            if (status === "ALL") {
                const [p, a, r] = await Promise.all([
                    fetchOne("PENDING"),
                    fetchOne("APPROVED"),
                    fetchOne("REJECTED"),
                ]);
                list = [...p, ...a, ...r];
            } else {
                list = await fetchOne(status);
            }



            setEntries(list);

            setBusy(false);
        } catch {
            setEntries([]);
            setFatal("Failed to load hours.");
            setBusy(false);
        }
    }

    useEffect(() => {
        if (loading) return;
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, month, status]);

    const rows = useMemo(() => {
        return entries.map((e) => {
            const id = Number(pick(e, ["id"], 0));
            const workDate = String(pick(e, ["workDate", "date"], ""));
            const fromTime = String(pick(e, ["fromTime"], ""));
            const toTime = String(pick(e, ["toTime"], ""));
            const breakMinutes = Number(pick(e, ["breakMinutes"], 0));
            const hours = pick(e, ["hoursNet", "hoursBrut"], null);
            const st = String(pick(e, ["status"], "PENDING")) as HourStatus;

            const employeeName = String(pick(e, ["employeeName", "employee", "employee.name"], ""));
            const projectName = String(pick(e, ["projectName", "project", "project.name"], ""));
            const description = String(pick(e, ["description"], ""));

            return {
                raw: e,
                id,
                workDate,
                fromTime,
                toTime,
                breakMinutes,
                hours,
                status: st,
                employeeName,
                projectName,
                description,
            };
        });
    }, [entries]);

    async function approve(id: number) {
        setActionBusyId(id);
        setFatal(null);
        try {
            const res = await fetch(`/api/admin/hours/${id}/approve`, { method: "POST" });
            const payload = await res.json();
            if (!payload?.ok) {
                setFatal(toErrorMessage(payload, "Failed to approve."));
                setActionBusyId(null);
                return;
            }

            await load();
            setActionBusyId(null);
        } catch {
            setFatal("Failed to approve.");
            setActionBusyId(null);
        }
    }

    async function reject(id: number) {
        const reason = window.prompt("Reject reason?");
        if (!reason) return;

        setActionBusyId(id);
        setFatal(null);

        try {
            const res = await fetch(`/api/admin/hours/${id}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rejectReason: reason }),
            });
            const payload = await res.json();
            if (!payload?.ok) {
                setFatal(toErrorMessage(payload, "Failed to reject."));
                setActionBusyId(null);
                return;
            }

            await load();
            setActionBusyId(null);
        } catch {
            setFatal("Failed to reject.");
            setActionBusyId(null);
        }
    }

    if (loading) return null;

    return (
        <main className="min-h-screen bg-background text-foreground">
            <div className="mx-auto max-w-5xl px-4 py-10 flex flex-col gap-6">
                <header className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Admin · Hours</h1>
                        <p className="text-sm text-muted-foreground">
                            Review and approve/reject submitted hours.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" asChild>
                            <Link href="/admin">Dashboard</Link>
                        </Button>
                        <LogoutButton />
                    </div>
                </header>

                <section className="rounded-xl border bg-card p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground">Month</label>
                            <input
                                type="month"
                                className="border rounded-md px-3 py-2 text-sm bg-background"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-sm text-muted-foreground">Status</label>
                            <select
                                className="border rounded-md px-3 py-2 text-sm bg-background"
                                value={status}
                                onChange={(e) => setStatus(e.target.value as any)}
                            >
                                <option value="PENDING">PENDING</option>
                                <option value="REJECTED">REJECTED</option>
                                <option value="ALL">ALL</option>
                            </select>

                            <Button variant="outline" onClick={load} disabled={busy}>
                                {busy ? "Loading…" : "Refresh"}
                            </Button>
                        </div>
                    </div>

                    {fatal ? (
                        <p className="mt-4 text-sm text-red-600">{fatal}</p>
                    ) : null}

                    <div className="mt-6 flex flex-col gap-3">
                        {busy ? (
                            <p className="text-sm text-muted-foreground">Loading…</p>
                        ) : rows.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No entries found.</p>
                        ) : (
                            rows.map((r) => (
                                <div key={r.id} className="rounded-lg border p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="font-medium">
                                                {r.employeeName || "Employee"} · {r.workDate} · {r.fromTime}–{r.toTime} · break{" "}
                                                {r.breakMinutes}m
                                            </div>

                                            <div className="text-sm text-muted-foreground">
                                                Status: <span className="font-medium">{r.status}</span>
                                                {r.projectName ? (
                                                    <>
                                                        {" "}
                                                        · Project: <span className="font-medium">{r.projectName}</span>
                                                    </>
                                                ) : null}
                                                {r.description ? (
                                                    <>
                                                        {" "}
                                                        · <span className="italic">{r.description}</span>
                                                    </>
                                                ) : null}
                                                {r.hours !== null && r.hours !== undefined ? (
                                                    <>
                                                        {" "}
                                                        · Hours: <span className="font-medium">{r.hours}</span>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={r.status === "APPROVED" || actionBusyId === r.id}
                                                onClick={() => approve(r.id)}
                                            >
                                                {actionBusyId === r.id ? "Working…" : "Approve"}
                                            </Button>

                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={r.status === "APPROVED" || actionBusyId === r.id}
                                                onClick={() => reject(r.id)}
                                            >
                                                Reject
                                            </Button>
                                        </div>
                                    </div>

                                    {r.status === "APPROVED" ? (
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            Approved entries are immutable.
                                        </p>
                                    ) : null}
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
