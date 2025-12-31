"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type ApiError = { ok: false; error: { code?: string; message?: string } } | { ok?: false; error?: any };

type MeOk = {
  ok: true;
  data: {
    employeeId: number;
    companyId: number;
    companyName: string | null;
    name: string | null;
    role: "EMPLOYEE" | "ADMIN" | "OWNER";
  };
};


type Project = { id: number; name: string; isActive?: boolean };
type HourStatus = "PENDING" | "APPROVED" | "REJECTED";

type HourEntry = {
  id: number;
  workDate: string; // YYYY-MM-DD
  fromTime: string; // HH:MM
  toTime: string; // HH:MM
  breakMinutes: number;
  hoursNet?: number;
  hoursBrut?: number;
  status: HourStatus;
  rejectReason?: string | null;
  projectId?: number | null;
  projectName?: string | null;
  description?: string | null;
};

function todayMonthISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function toErrorMessage(payload: any, fallback: string) {
  return payload?.error?.message ?? fallback;
}


export default function EmployeePage() {
  const [checking, setChecking] = useState(true);
  const [me, setMe] = useState<MeOk["data"] | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(todayMonthISO());
  const [projects, setProjects] = useState<Project[]>([]);
  const activeProjects = useMemo(
    () => projects.filter((p) => p.isActive !== false),
    [projects],
  );

  const [entries, setEntries] = useState<HourEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // form state
  const [workDate, setWorkDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [fromTime, setFromTime] = useState("09:00");
  const [toTime, setToTime] = useState("17:00");
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [projectId, setProjectId] = useState<number | "">("");
  const [description, setDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // 1) load session
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const payload = (await res.json()) as MeOk | ApiError | any;

        if (cancelled) return;

        if (payload?.ok && payload?.data?.employeeId) {
          setMe(payload.data);
          setChecking(false);
          return;
        }



        // not authed
        window.location.href = "/login";
      } catch {
        if (!cancelled) {
          setFatal("Failed to verify session.");
          setChecking(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) load projects (company scoped)
  useEffect(() => {
    if (!me) return;
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        const payload = await res.json();

        if (cancelled) return;

        if (!payload?.ok) return; // projects are nice-to-have for now

        const list = payload?.data?.projects;
        if (Array.isArray(list)) setProjects(list);

      } catch {
        // ignore for V1 (hours can still be entered if backend allows null project)
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [me]);

  // 3) load entries for month
  useEffect(() => {
    if (!me) return;
    let cancelled = false;

    async function run() {
      setLoadingEntries(true);
      try {
        const res = await fetch(`/api/employee/hours?month=${encodeURIComponent(month)}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (cancelled) return;

        if (!json.ok) {
          setFatal(toErrorMessage(json, "Failed to load hours."));
          setEntries([]);
          setLoadingEntries(false);
          return;
        }

        const list = Array.isArray(json.data?.entries) ? json.data.entries : [];
        setEntries(list);

        setLoadingEntries(false);
      } catch {
        if (!cancelled) {
          setFatal("Failed to load hours.");
          setEntries([]);
          setLoadingEntries(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [me, month]);

  if (checking) return null;

  if (fatal) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full border rounded-xl p-6">
          <h1 className="text-xl font-semibold mb-2">Employee</h1>
          <p className="text-sm text-red-600">{fatal}</p>
          <div className="mt-4">
            <Button variant="outline" asChild>
              <Link href="/login">Go to login</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const canEdit = (e: HourEntry) => e.status === "PENDING" || e.status === "REJECTED";

  function startEdit(e: HourEntry) {
    setEditingId(e.id);
    setEditError(null);

    setWorkDate(e.workDate);
    setFromTime(e.fromTime);
    setToTime(e.toTime);
    setBreakMinutes(e.breakMinutes ?? 0);
    setProjectId((e.projectId ?? "") as any);
    setDescription(e.description ?? "");

  }

  function resetForm() {
    setEditingId(null);
    setSubmitError(null);
    setEditError(null);
    setProjectId("");
    setDescription("");
  }

  async function submitCreateOrEdit() {
    if (!me) return;

    const body = {
      date: workDate,
      fromTime,
      toTime,
      breakMinutes: Number(breakMinutes) || 0,
      projectId: Number(projectId),
      description: description.trim() || null,
    };

    if (!body.date || !body.fromTime || !body.toTime) {
      setSubmitError("Please fill work date and times.");
      return;
    }
    if (projectId === "") {
      setSubmitError("Project is required.");
      return;
    }
    if (!workDate.startsWith(month)) {
      setSubmitError("Work date must be within the selected month.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setEditError(null);

    try {
      const isEdit = typeof editingId === "number";
      const url = isEdit ? `/api/employee/hours/${editingId}` : "/api/employee/hours";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!json.ok) {
        const msg = toErrorMessage(json, isEdit ? "Failed to update hour entry." : "Failed to create hour entry.");
        if (isEdit) setEditError(msg);
        else setSubmitError(msg);
        setSubmitting(false);
        return;
      }

      // reload month list (simple + reliable for V1)
      const reload = await fetch(`/api/employee/hours?month=${encodeURIComponent(month)}`, { cache: "no-store" });
      const reloadJson = await reload.json();

      if (!reloadJson.ok) {
        const msg = toErrorMessage(reloadJson, "Failed to reload hours.");
        if (isEdit) setEditError(msg);
        else setSubmitError(msg);
        setSubmitting(false);
        return;
      }

      const list = Array.isArray(reloadJson.data?.entries) ? reloadJson.data.entries : [];
      setEntries(list);


      resetForm();
      setSubmitting(false);
    } catch {
      const msg = typeof editingId === "number" ? "Failed to update hour entry." : "Failed to create hour entry.";
      if (typeof editingId === "number") setEditError(msg);
      else setSubmitError(msg);
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10 flex flex-col gap-8">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Employee</h1>
            <p className="text-sm text-muted-foreground">
              {me?.name ?? "Employee"} · {me?.companyName ?? "Company"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await fetch("/api/auth/logout", { method: "POST" });
                } finally {
                  window.location.href = "/login";
                }
              }}
            >
              Log out
            </Button>

          </div>
        </header>

        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold">
              {editingId ? "Edit hour entry" : "Register hours"}
            </h2>

            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Month</label>
              <input
                type="month"
                className="border rounded-md px-3 py-2 text-sm bg-background"
                value={month}
                onChange={(e) => {
                  const m = e.target.value;
                  setMonth(m);
                  if (m) setWorkDate(`${m}-01`);
                }}

              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">Work date</label>
              <input
                type="date"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Project</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">Select project</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">From</label>
              <input
                type="time"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">To</label>
              <input
                type="time"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Break (minutes)</label>
              <input
                type="number"
                min={0}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(Number(e.target.value))}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>

          </div>

          {(submitError || editError) && (
            <p className="mt-4 text-sm text-red-600">{submitError || editError}</p>
          )}

          <div className="mt-5 flex gap-2">
            <Button onClick={submitCreateOrEdit} disabled={submitting}>
              {submitting ? "Saving…" : editingId ? "Save changes" : "Submit"}
            </Button>

            {editingId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => resetForm()}
                disabled={submitting}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Your hours</h2>

          {loadingEntries ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries for this month.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map((e) => (
                <div key={e.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {e.workDate} · {e.fromTime}–{e.toTime} · break {e.breakMinutes}m
                      </div>

                      <div className="text-sm text-muted-foreground">
                        Status: <span className="font-medium">{e.status}</span>
                        {e.status === "REJECTED" && e.rejectReason ? (
                          <>
                            {" "}
                            · <span className="text-red-600">{e.rejectReason}</span>
                          </>
                        ) : null}
                        {(typeof e.hoursNet === "number" || typeof e.hoursBrut === "number") ? (
                          <>
                            {" "}
                            · hours{" "}
                            <span className="font-medium">
                              {typeof e.hoursNet === "number" ? e.hoursNet : e.hoursBrut}
                            </span>
                          </>
                        ) : null}
                      </div>

                      {e.projectName ? (
                        <div className="text-sm text-muted-foreground">
                          Project: <span className="font-medium">{e.projectName}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!canEdit(e)}
                        onClick={() => startEdit(e)}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>

                  {!canEdit(e) ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Approved entries can’t be edited.
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
