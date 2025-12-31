"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/useRouteGuard";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";


export default function AdminProjectsPage() {
  const { loading } = useRequireAuth({ redirectTo: "/login" });

  const [projects, setProjects] = useState<{ id: number; name: string; isActive: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {


        const res = await fetch("/api/projects", { cache: "no-store" });
        const payload = await res.json();

        if (cancelled) return;

        if (!payload?.ok) {
          setError(payload?.error?.message ?? "Failed to load projects.");
          return;
        }

        const list = payload?.data?.projects;
        if (!Array.isArray(list)) {
          setError("Failed to load projects.");
          return;
        }

        setProjects(
          list.map((p: any) => ({
            id: p.id,
            name: p.name,
            isActive: true, // V1: API does not expose isActive yet
          }))
        );




      } catch {
        if (!cancelled) setError("Failed to load projects.");
      }
    }

    if (!loading) run();
    return () => {
      cancelled = true;
    };
  }, [loading]);

  async function createProject() {
    if (!newName.trim()) {
      setError("Project name is required.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      const payload = await res.json();

      if (!payload?.ok) {
        setError(payload?.error?.message ?? "Failed to create project.");
        setCreating(false);
        return;
      }

      const created = payload?.data;
      setProjects((prev) => [
        ...prev,
        { id: created.id, name: created.name, isActive: true },
      ]);


      setNewName("");
      setCreating(false);
    } catch {
      setError("Failed to create project.");
      setCreating(false);
    }
  }



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
            <Link className="text-sm font-medium pb-1 border-b-2 border-primary" href="/admin/projects">
              Projects
            </Link>
            <Link className="text-sm font-medium pb-1 border-b-2 border-transparent text-muted-foreground" href="/admin/employees">
              Employees
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-hidden pt-2">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-lg font-semibold mb-3">Projects</h2>

            <div className="flex items-center gap-2 mb-4">
              <input
                className="border rounded-md px-3 py-2 text-sm bg-background flex-1"
                placeholder="New project name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Button size="sm" onClick={createProject} disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </div>


            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            ) : (
              <ul className="divide-y">
                {projects.map((p) => (
                  <li key={p.id} className="py-2 flex items-center justify-between">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {p.isActive ? "Active" : "Inactive"}
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
