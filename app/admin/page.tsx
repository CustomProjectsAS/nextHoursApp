"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRequireAuth } from "@/lib/useRouteGuard";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";


type DashboardCounts = {
  hoursPendingCount: number;
  hoursRejectedCount: number;
  activeEmployeesCount: number;
  activeProjectsCount: number;
};

function toErrorMessage(payload: any, fallback: string) {
  return payload?.error?.message ?? fallback;
}


export default function AdminDashboardPage() {
  const { loading } = useRequireAuth({ redirectTo: "/login" });

  const [data, setData] = useState<DashboardCounts | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [me, setMe] = useState<{ name: string | null; companyName: string | null } | null>(null);

  useEffect(() => {
    if (loading) return;

    let cancelled = false;

    async function run() {
      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        const mePayload = await meRes.json();
        if (mePayload?.ok && mePayload.data) {
          setMe({
            name: mePayload.data.name ?? null,
            companyName: mePayload.data.companyName ?? null,
          });
        }



        const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
        const payload = await res.json();

        if (cancelled) return;

        if (!payload?.ok) {
          setFatal(toErrorMessage(payload, "Failed to load dashboard."));
          return;
        }

        const d = payload?.data;

        if (
          d &&
          typeof d.hoursPendingCount === "number" &&
          typeof d.hoursRejectedCount === "number" &&
          typeof d.activeEmployeesCount === "number" &&
          typeof d.activeProjectsCount === "number"
        ) {
          setData(d);
          return;
        }


        setFatal("Dashboard response shape is invalid.");
      } catch {
        if (!cancelled) setFatal("Failed to load dashboard.");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [loading]);

  if (loading) return null;

  if (fatal) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full border rounded-xl p-6">
          <h1 className="text-xl font-semibold mb-2">Admin</h1>
          <p className="text-sm text-red-600">{fatal}</p>
          <div className="mt-4">
            <Button variant="outline" asChild>
              <Link href="/admin/hours">Go to Hours</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!data) return null;

  const pendingHighlight = data.hoursPendingCount > 0;

  const Tile = ({
    title,
    subtitle,
    href,
    highlight,
  }: {
    title: string;
    subtitle: string;
    href: string;
    highlight?: boolean;
  }) => (
    <Link
      href={href}
      className={[
        "rounded-2xl border p-6 shadow-sm transition",
        "bg-card hover:shadow-md",
        highlight ? "border-orange-400" : "",
      ].join(" ")}
    >
      <div className="text-2xl font-bold tracking-tight">{title}</div>
      <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div>
      {highlight ? (
        <div className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold border border-orange-400">
          Attention needed
        </div>
      ) : null}
    </Link>
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10 flex flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Admin</h1>
            <p className="text-sm text-muted-foreground">
              {me?.name ? `Hi, ${me.name}` : "Hi"} · {me?.companyName ?? "Company"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LogoutButton />
          </div>
        </header>


        <section className="grid gap-4 md:grid-cols-2">
          <Tile
            title="Hours"
            subtitle={`${data.hoursPendingCount} pending · ${data.hoursRejectedCount} rejected`}
            href="/admin/hours"
            highlight={pendingHighlight}
          />
          <Tile
            title="Timeline"
            subtitle="Day view"
            href="/admin/timeline"
          />
          <Tile
            title="Employees"
            subtitle={`${data.activeEmployeesCount} active`}
            href="/admin/employees"
          />
          <Tile
            title="Projects"
            subtitle={`${data.activeProjectsCount} active`}
            href="/admin/projects"
          />
        </section>
      </div>
    </main>
  );
}
