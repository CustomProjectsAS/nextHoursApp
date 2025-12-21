"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";


type EmployeeOption = {
  id: number;
  name: string;
};

type ProjectOption = {
  id: number;
  name: string;
  color?: string | null;
};
function EmployeeHoursContent() {
  const [date, setDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10); // today YYYY-MM-DD
  });
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [employeeName, setEmployeeName] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);

  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loadingEmployee, setLoadingEmployee] = useState(true);
  // new time-related state
  const [fromTime, setFromTime] = useState<string>("08:00");
  const [toTime, setToTime] = useState<string>("16:00");
  const [breakMinutes, setBreakMinutes] = useState<string>("0");

  const [note, setNote] = useState<string>("");


  const [saving, setSaving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    async function identifyEmployee() {
      if (!token) {
        setError("Missing login token.");
        setLoadingEmployee(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/onboarding/validate?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.error || "Invalid or expired token.");
          setLoadingEmployee(false);
          return;
        }

        // This is the employee ID we should use for hour submission
        setEmployeeId(data.employee.id);
        setEmployeeName(data.employee.name ?? null);
      } catch (err) {
        console.error(err);
        setError("Failed to verify employee.");
      } finally {
        setLoadingEmployee(false);
      }
    }

    identifyEmployee();
  }, [token]);

  useEffect(() => {
    async function loadOptions() {
      try {
        setLoadingOptions(true);
        setOptionsError(null);

        const [empRes, projRes] = await Promise.all([
          fetch("/api/employees"),
          fetch("/api/projects"),
        ]);

        if (!empRes.ok) {
          throw new Error("Failed to load employees");
        }
        if (!projRes.ok) {
          throw new Error("Failed to load projects");
        }

        const employeesData: EmployeeOption[] = await empRes.json();
        const projectsData: ProjectOption[] = await projRes.json();

        setEmployees(employeesData);
        setProjects(projectsData);

        // Employee comes from token now – do NOT override it here.
        if (projectsData.length > 0) {
          setProjectId(projectsData[0].id);
        }

      } catch (err: any) {
        console.error(err);
        setOptionsError(err.message || "Failed to load employees/projects");
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    // parse break minutes from string to number
    const breakM = parseInt(breakMinutes || "0", 10);

    if (isNaN(breakM) || breakM < 0) {
      setSaving(false);
      setError("Break must be a non-negative number.");
      return;
    }

    if (!employeeId) {
      setSaving(false);
      setError("Please choose an employee.");
      return;
    }

    if (!projectId) {
      setSaving(false);
      setError("Please choose a project.");
      return;
    }


    try {
      const res = await fetch("/api/employee/hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          projectId,
          date,                 // "YYYY-MM-DD"
          fromTime,             // from state
          toTime,               // from state
          breakMinutes: breakM, // number
          description: note || undefined,
        }),

      });

      // try to parse JSON, but don't crash if it's HTML or empty
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // ignore JSON parse error
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save hours");
      }


      setMessage("Hours saved!");
      // optionally clear note
      // setNote("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unknown error");
    } finally {
      setSaving(false);
    }
  }

   const isSubmitDisabled =
    saving ||
    loadingEmployee ||
    loadingOptions ||
    !!optionsError ||
    !employeeId ||
    projects.length === 0;


  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Employee hours</h1>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </header>

        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-4 text-lg font-semibold">Register hours</h2>

          {optionsError && (
            <p className="mb-4 text-sm font-medium text-red-600">
              {optionsError}
            </p>
          )}

          <form className="space-y-4" onSubmit={onSubmit}>
            {/* Date */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Employee */}
            {/* Employee info (fixed from token) */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Employee</label>
              <p className="text-sm rounded-md border border-input bg-muted/40 px-3 py-2">
                {loadingEmployee
                  ? "Checking who you are…"
                  : employeeName || `Employee #${employeeId}`}
              </p>
            </div>


            {/* Project */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Project</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none"
                value={projectId ?? ""}
                onChange={(e) =>
                  setProjectId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                disabled={loadingOptions || projects.length === 0}
              >
                {loadingOptions && <option>Loading projects…</option>}
                {!loadingOptions && projects.length === 0 && (
                  <option value="">No projects available</option>
                )}
                {!loadingOptions && projects.length > 0 && (
                  <>
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* From time */}
            <div className="space-y-1">
              <label className="text-sm font-medium">From</label>
              <input
                type="time"
                className="h-9 w-full max-w-[180px] rounded-md border border-input bg-background px-3 text-sm outline-none"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
              />
            </div>

            {/* To time */}
            <div className="space-y-1">
              <label className="text-sm font-medium">To</label>
              <input
                type="time"
                className="h-9 w-full max-w-[180px] rounded-md border border-input bg-background px-3 text-sm outline-none"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
              />
            </div>

            {/* Break minutes */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Break <span className="text-xs text-muted-foreground">(minutes)</span>
              </label>
              <input
                type="number"
                min="0"
                className="h-9 w-full max-w-[150px] rounded-md border border-input bg-background px-3 text-sm outline-none"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
              />
            </div>



            {/* Note */}
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Note{" "}
                <span className="text-xs text-muted-foreground">
                  (optional)
                </span>
              </label>
              <textarea
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                placeholder="Short comment about today…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {/* Status messages */}
            {message && (
              <p className="text-sm font-medium text-emerald-600">{message}</p>
            )}
            {error && (
              <p className="text-sm font-medium text-red-600">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full md:w-auto"
              disabled={isSubmitDisabled}
            >
              {saving
                ? "Saving…"
                : loadingOptions
                  ? "Loading…"
                  : "Save hours"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default function EmployeeHoursPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading…</div>}>
      <EmployeeHoursContent />
    </Suspense>
  );
}

