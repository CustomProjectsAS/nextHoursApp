"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type ValidateOk = {
  ok: true;
  data: {
    invite: {
      companyName: string | null;
      status: string; // EmployeeStatus string from API
    };
  };
};


type ApiError = {
  ok: false;
  error: { code: string; message: string; details?: any };
};

type ValidateResponse = ValidateOk | ApiError;

type EmptyObject = Record<string, never>;
type CompleteOk = { ok: true; data: EmptyObject };

type CompleteResponse = CompleteOk | ApiError;


function OnboardPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = useMemo(() => searchParams.get("token"), [searchParams]);

  const [loading, setLoading] = useState(true);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [invite, setInvite] = useState<ValidateOk["data"]["invite"]
    | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setValidateError("Missing invite token in the link.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setValidateError(null);

        const res = await fetch(
          `/api/onboarding/validate?token=${encodeURIComponent(token)}`,
        );

        const data: ValidateResponse = await res.json();

                if (!data.ok) {
          setValidateError(
            data.ok === false
              ? data.error?.message ?? "Failed to validate invite link."
              : "Failed to validate invite link.",
          );

          setInvite(null);
          setLoading(false);
          return;
        }

        setInvite(data.data.invite);
        setLoading(false);
      } catch (err: any) {
        console.error("Error validating invite:", err);
        setValidateError("Something went wrong while validating the invite.");
        setInvite(null);
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSubmitError(null);

    const pw = password.trim();
    const pw2 = confirmPassword.trim();

    if (pw.length < 10) {
      setSubmitError("Password must be at least 10 characters.");
      return;
    }
    if (pw !== pw2) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: pw,
          name: name.trim() || undefined,
        }),
      });

      const data: CompleteResponse = await res.json();


      if (data.ok === false) {

        // complete route uses standardized error shape (ok:false, error:{...})
        setSubmitError(
          data.ok === false
            ? data.error?.message ?? "Failed to complete onboarding."
            : "Failed to complete onboarding.",
        );
        setSubmitting(false);
        return;
      }



      // Session cookie is now set. Resolve role landing via /api/auth/me.
      // Session cookie is now set. Resolve role landing via /api/auth/me.
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const me = await meRes.json();

      if (me?.ok && me?.data?.role) {
        const role = String(me.data.role);
        router.replace(role === "EMPLOYEE" ? "/employee" : "/admin");
        return;
      }


      // Fallback: send to /login (guard should redirect authed users away anyway)
      router.replace("/login");
      return;

    } catch (err: any) {
      console.error("Error completing onboarding:", err);
      setSubmitError("Something went wrong while completing onboarding.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Checking your invite…</p>
      </main>
    );
  }

  if (validateError) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full border rounded-xl p-6 shadow-sm">
          <h1 className="text-2xl font-semibold mb-4">Invite problem</h1>
          <p className="text-red-600 mb-2">{validateError}</p>
          <p className="text-sm text-gray-600">
            Please contact your employer and ask them to send you a new link.
          </p>
        </div>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Something went wrong. No invite data found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full border rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4">Activate your account</h1>

        <p className="text-sm text-gray-600 mb-4">
          You&apos;re joining{" "}
          <span className="font-medium">
            {invite.companyName ?? "your company"}
          </span>
          .
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Name (optional)
            </label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 10 characters"
              type="password"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Confirm password
            </label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
            />
          </div>

          {submitError && <p className="text-sm text-red-600">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md px-3 py-2 text-sm font-medium border bg-black text-white disabled:opacity-60"
          >
            {submitting ? "Activating…" : "Activate"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function OnboardPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-lg">Loading…</p>
        </main>
      }
    >
      <OnboardPageContent />
    </Suspense>
  );
}
