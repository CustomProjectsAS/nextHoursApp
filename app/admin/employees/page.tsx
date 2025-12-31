"use client";

import Link from "next/link";
import { useRequireAuth } from "@/lib/useRouteGuard";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";



export default function AdminEmployeesPage() {
  const { loading } = useRequireAuth({ redirectTo: "/login" });
  const [employees, setEmployees] = useState<
    { id: number; name: string; status: string }[]
  >([]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
                const res = await fetch("/api/employees", { cache: "no-store" });
        const payload = await res.json();

        if (cancelled) return;

        if (!payload?.ok) {
          setError(payload?.error?.message ?? "Failed to load employees.");
          return;
        }

        const list = payload?.data?.employees;
        if (!Array.isArray(list)) {
          setError("Failed to load employees.");
          return;
        }

        setEmployees(
          list.map((e: any) => ({
            id: e.id,
            name: e.name,
            status: String(e.status ?? "UNKNOWN"),
          }))
        );


      } catch {
        if (!cancelled) setError("Failed to load employees.");
      }
    }

    if (!loading) run();
    return () => {
      cancelled = true;
    };
  }, [loading]);


  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  return (
    <main className="h-screen bg-background text-foreground overflow-hidden">
      <div className="mx-auto flex h-full max-w-5xl flex-col px-4 py-2 overflow-hidden">
        <div className="sticky top-0 z-40 bg-background pt-2">
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin">Dashboard</Link>
              </Button>
              <LogoutButton />
            </div>
          </header>

          <div className="flex items-center gap-4 border-b pb-2">
            <Link className="text-sm font-medium pb-1 border-b-2 border-transparent text-muted-foreground" href="/admin/hours">
              Hours
            </Link>
            <Link className="text-sm font-medium pb-1 border-b-2 border-transparent text-muted-foreground" href="/admin/timeline">
              Timeline
            </Link>
            <Link className="text-sm font-medium pb-1 border-b-2 border-transparent text-muted-foreground" href="/admin/projects">
              Projects
            </Link>
            <Link className="text-sm font-medium pb-1 border-b-2 border-primary" href="/admin/employees">
              Employees
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-hidden pt-2">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-lg font-semibold mb-3">Employees</h2>

            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : employees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No employees yet.</p>
            ) : (
              <ul className="divide-y">
                {employees.map((e) => (
                  <li key={e.id} className="py-2 flex items-center justify-between">
                    <span className="font-medium">{e.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {e.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </div>
      </div>
    </main>
  );
}
