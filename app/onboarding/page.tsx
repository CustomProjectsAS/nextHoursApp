"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ValidateResponse =
  | {
      ok: true;
      employee: {
        id: number;
        name: string;
        email: string | null;
        companyName: string | null;
      };
    }
  | {
      ok?: false;
      error: string;
    };

function OnboardPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [validateError, setValidateError] = useState<string | null>(null);
  const [employee, setEmployee] =
    useState<ValidateResponse extends { ok: true; employee: infer E } ? E : any>(
      null,
    );
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidateError("Missing invite token in the link.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/onboarding/validate?token=${encodeURIComponent(token)}`,
        );
        const data: ValidateResponse = await res.json();

        if (!res.ok || !("ok" in data) || !data.ok) {
          setValidateError(
            (data as any).error || "Failed to validate invite link.",
          );
          setLoading(false);
          return;
        }

        setEmployee(data.employee);
        setName(data.employee.name || "");
        setLoading(false);
      } catch (err: any) {
        console.error("Error validating invite:", err);
        setValidateError("Something went wrong while validating the invite.");
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          name: name.trim() || employee?.name,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setSubmitError(data.error || "Failed to complete onboarding.");
        setSubmitting(false);
        return;
      }

      setDone(true);
      setSubmitting(false);
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

  if (!employee) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Something went wrong. No employee data found.</p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full border rounded-xl p-6 shadow-sm">
          <h1 className="text-2xl font-semibold mb-4">You’re all set ✅</h1>
          <p className="mb-2">
            Welcome, <span className="font-medium">{employee.name}</span>.
          </p>
          <p className="text-sm text-gray-600">
            Your account is now active. You can close this page or go to the
            hours app (we’ll wire auto-redirect later).
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full border rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-4">Complete your setup</h1>

        <p className="text-sm text-gray-600 mb-4">
          You&apos;re joining{" "}
          <span className="font-medium">
            {employee.companyName ?? "your company"}
          </span>
          .
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              className="w-full border rounded-md px-3 py-2 text-sm bg-gray-100"
              value={employee.email ?? ""}
              disabled
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md px-3 py-2 text-sm font-medium border bg-black text-white disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Finish"}
          </button>
        </form>
      </div>
    </main>
  );
}export default function OnboardPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center"><p className="text-lg">Loading…</p></main>}>
      <OnboardPageContent />
    </Suspense>
  );
}

