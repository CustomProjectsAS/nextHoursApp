"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRequireAuth } from "@/lib/useRouteGuard";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";


type ApiEntry = any;

function monthISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

export default function AdminTimelinePage() {
  const { loading } = useRequireAuth({ redirectTo: "/login" });

  const [month, setMonth] = useState<string>(() => monthISO());
  const [entries, setEntries] = useState<ApiEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;

    let cancelled = false;

    async function run() {
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set("month", month);

        const fetchOne = async (st: "PENDING" | "APPROVED" | "REJECTED") => {
          const qs2 = new URLSearchParams(qs);
          qs2.set("status", st);
          const res = await fetch(`/api/admin/hours?${qs2.toString()}`, { cache: "no-store" });
          const payload = await res.json();

          if (!payload?.ok) {
            throw new Error(payload?.error?.message ?? "Failed to load hours");
          }

          return normalizeEntries(payload);
        };


        const [p, a, r] = await Promise.all([
          fetchOne("PENDING"),
          fetchOne("APPROVED"),
          fetchOne("REJECTED"),
        ]);

        if (!cancelled) setEntries([...p, ...a, ...r]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load timeline.");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [loading, month]);

  const grouped = useMemo(() => {
    // group by workDate (YYYY-MM-DD preferred; fall back to whatever string is present)
    const byDay = new Map<string, ApiEntry[]>();

    for (const e of entries) {
      const workDate = String(pick(e, ["workDate", "date"], "UNKNOWN_DATE"));
      const key = workDate.slice(0, 10); // works for "2025-12-28..." too
      const arr = byDay.get(key) ?? [];
      arr.push(e);
      byDay.set(key, arr);
    }

    // sort days desc (newest first)
    const days = Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));

    return days.map(([day, items]) => {
      const rows = items.map((e) => {
        const id = Number(pick(e, ["id"], 0));
        const fromTime = String(pick(e, ["fromTime"], ""));
        const toTime = String(pick(e, ["toTime"], ""));
        const breakMinutes = Number(pick(e, ["breakMinutes"], 0));
        const status = String(pick(e, ["status"], ""));
        const hours = pick(e, ["hoursNet", "hoursBrut"], null);

        const employeeName = String(pick(e, ["employeeName", "employee", "employee.name"], "Employee"));
        const projectName = String(pick(e, ["projectName", "project", "project.name"], ""));
        const description = String(pick(e, ["description"], ""));

        return { id, fromTime, toTime, breakMinutes, status, hours, employeeName, projectName, description };
      });

      // sort rows by fromTime
      rows.sort((x, y) => (x.fromTime > y.fromTime ? 1 : -1));

      return { day, rows };
    });
  }, [entries]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 flex flex-col gap-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin · Timeline</h1>
            <p className="text-sm text-muted-foreground">Day view (derived from hours)</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin">Dashboard</Link>
            </Button>
            <LogoutButton />

          </div>
        </header>

        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground">Month</label>
          <input
            type="month"
            className="border rounded-md px-3 py-2 text-sm bg-background"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4 border-b pb-2">
          <Link className="text-sm font-medium pb-1 border-b-2 border-transparent text-muted-foreground" href="/admin/hours">
            Hours
          </Link>
          <Link className="text-sm font-medium pb-1 border-b-2 border-primary" href="/admin/timeline">
            Timeline
          </Link>
          <Link className="text-sm font-medium pb-1 border-b-2 border-transparent text-muted-foreground" href="/admin/projects">
            Projects
          </Link>
          <Link className="text-sm font-medium pb-1 border-b-2 border-transparent text-muted-foreground" href="/admin/employees">
            Employees
          </Link>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries found for this month.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {grouped.map((g) => (
              <section key={g.day} className="rounded-xl border bg-card p-4">
                <h2 className="font-semibold mb-3">{g.day}</h2>
                <div className="flex flex-col gap-2">
                  {g.rows.map((r) => (
                    <div key={r.id} className="rounded-lg border p-3">
                      <div className="font-medium">
                        {r.employeeName} · {r.fromTime}–{r.toTime} · break {r.breakMinutes}m
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {r.projectName ? (
                          <>
                            Project: <span className="font-medium">{r.projectName}</span> ·{" "}
                          </>
                        ) : null}
                        Status: <span className="font-medium">{r.status}</span>
                        {r.hours !== null && r.hours !== undefined ? (
                          <>
                            {" "}
                            · Hours: <span className="font-medium">{r.hours}</span>
                          </>
                        ) : null}
                        {r.description ? (
                          <>
                            {" "}
                            · <span className="italic">{r.description}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
