
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type MeOk = {
  ok: true;
  user: {
    role: "EMPLOYEE" | "ADMIN" | "OWNER";
  };
};

export default function Home() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/api/auth/me", { method: "GET" });
        const data = (await res.json()) as MeOk | any;

        if (cancelled) return;

        if (res.ok && data?.ok && data?.user?.role) {
          const role = String(data.user.role);
          window.location.href = role === "EMPLOYEE" ? "/employee" : "/admin";
          return;
        }

        setChecking(false);
      } catch {
        if (!cancelled) setChecking(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Avoid flashing the landing page for logged-in users
  if (checking) return null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-14">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">CP Hours</h1>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Start free</Link>
            </Button>
          </div>
        </header>

        <section className="rounded-xl border bg-card p-8 shadow-sm">
          <h2 className="mb-3 text-2xl font-semibold">Hours tracking that doesn’t waste your day</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Employees register hours fast. Admins approve with confidence. Built for real shift-based companies.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/signup">Create company account</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="mb-2 text-lg font-semibold">Employees</h3>
            <p className="text-sm text-muted-foreground">
              Register hours from phone or PC. See approval status and rejections.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h3 className="mb-2 text-lg font-semibold">Admins</h3>
            <p className="text-sm text-muted-foreground">
              Review, approve/reject, and keep a clean audit trail for your company.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
