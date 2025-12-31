"use client";

import { useEffect, useState } from "react";

export type MeUser = {
  employeeId: number;
  companyId: number;
  role: "EMPLOYEE" | "ADMIN" | "OWNER";
  name: string;
  companyName: string;
};

type MeOk = { ok: true; user: MeUser };
type MeFail = { ok: false; error: string };

async function fetchMe(): Promise<MeOk | MeFail> {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  const data = (await res.json()) as any;
  return data;
}

export function useRequireAuth(opts?: { redirectTo?: string }) {
  const redirectTo = opts?.redirectTo ?? "/login";

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<MeUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchMe();

        if (cancelled) return;

        if (!data || data.ok === false) {
          window.location.replace(redirectTo);
          return;
        }

        setUser(data.user);
      } catch {
        if (!cancelled) window.location.replace(redirectTo);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [redirectTo]);

  return { loading, user };
}

export function useRedirectIfAuthed(opts?: { redirectTo?: string }) {
  const redirectTo = opts?.redirectTo ?? "/";

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchMe();

        if (cancelled) return;

        if (data && data.ok === true) {
          window.location.replace(redirectTo);
          return;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [redirectTo]);

  return { loading };
}
