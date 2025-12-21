"use client";

import { HoursTab } from "./hoursTab";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { TimelineTab } from "./timelineTab";

type HourStatus = "approved" | "pending";

type HourEntry = {
  id: number;
  date: string;
  from: string;
  to: string;
  breakLabel: string;
  hoursNet: number;
  projectName: string;
  projectColor: string;
  description: string;
  status: HourStatus;
};

type EmployeeBlock = {
  id: number;
  name: string;
  totalNet: number;
  totalBrut: number;
  entries: HourEntry[];
};

export type AdminHoursData = {
  month: string;
  monthLabel: string;
  totalNet: number;
  totalBrut: number;
  entriesCount: number;
  employees: EmployeeBlock[];
};

type EmployeeListItem = {
  id: number;
  name: string;
  email?: string | null;
  status?: string;
};

// simple helper – calls our API route
async function getAdminHours(monthOffset = 0): Promise<AdminHoursData> {
  const res = await fetch(`/api/admin/hours?monthOffset=${monthOffset}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to load admin hours");
  }

  return res.json();
}


async function getEmployees(): Promise<EmployeeListItem[]> {
  const res = await fetch("/api/employees", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to load employees");
  }

  return res.json();
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<
    "hours" | "timeline" | "projects" | "employees"
  >("hours");
  const [data, setData] = useState<AdminHoursData | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [hoursLoading, setHoursLoading] = useState(false);

  const [employees, setEmployees] = useState<EmployeeListItem[] | null>(null);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    // load hours data
    setHoursLoading(true);
    getAdminHours(0)
      .then(setData)
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setHoursLoading(false);
      });

    // load employees list
    setEmployeesLoading(true);
    getEmployees()
      .then((emps) => {
        setEmployees(emps);
        setEmployeesError(null);
      })
      .catch((err) => {
        console.error(err);
        setEmployeesError("Failed to load employees.");
      })
      .finally(() => {
        setEmployeesLoading(false);
      });
  }, []);
  useEffect(() => {
    let cancelled = false;

    setHoursLoading(true);
    getAdminHours(monthOffset)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setHoursLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [monthOffset]);


  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setLatestInviteUrl(null);

    const name = newEmpName.trim();
    const email = newEmpEmail.trim();

    if (!name || !email) {
      setCreateError("Name and email are required.");
      return;
    }

    try {
      setCreatingEmployee(true);

      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCreateError(data.error || "Failed to create employee.");
        setCreatingEmployee(false);
        return;
      }

      // invite URL from backend
      setLatestInviteUrl(data.inviteUrl ?? null);

      // Optimistically add to list
      if (data.employee) {
        setEmployees((prev) =>
          prev ? [...prev, data.employee as EmployeeListItem] : [data.employee],
        );
      }

      // Reset form
      setNewEmpName("");
      setNewEmpEmail("");
      setCreatingEmployee(false);
    } catch (err: any) {
      console.error("Create employee error:", err);
      setCreateError("Something went wrong while creating the employee.");
      setCreatingEmployee(false);
    }
  };

  if (!data) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

 return (
  <main className="h-screen bg-background text-foreground overflow-hidden">
    <div className="mx-auto flex h-full max-w-5xl flex-col px-4 py-2 overflow-hidden">

      {/* STICKY HEADER AREA */}
      <div className="sticky top-0 z-40 bg-background pt-2">
        <header className="flex items-center justify-between">

          <h1 className="text-2xl font-bold tracking-tight">Admin dashboard</h1>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b pb-2">
          <button
            onClick={() => setActiveTab("hours")}
            className={`text-sm font-medium pb-1 border-b-2 ${activeTab === "hours"
              ? "border-primary"
              : "border-transparent text-muted-foreground"
              }`}
          >
            Hours
          </button>

          <button
            onClick={() => setActiveTab("timeline")}
            className={`text-sm font-medium pb-1 border-b-2 ${activeTab === "timeline"
              ? "border-primary"
              : "border-transparent text-muted-foreground"
              }`}
          >
            Timeline
          </button>

          <button
            onClick={() => setActiveTab("projects")}
            className={`text-sm font-medium pb-1 border-b-2 ${activeTab === "projects"
              ? "border-primary"
              : "border-transparent text-muted-foreground"
              }`}
          >
            Projects
          </button>

          <button
            onClick={() => setActiveTab("employees")}
            className={`text-sm font-medium pb-1 border-b-2 ${activeTab === "employees"
              ? "border-primary"
              : "border-transparent text-muted-foreground"
              }`}
          >
            Employees
          </button>
        </div>
        </div>




<div className="flex-1 overflow-hidden pt-2">

        {activeTab === "hours" && <HoursTab data={data} onPrevMonth={() => setMonthOffset((v) => v - 1)}
          onNextMonth={() => setMonthOffset((v) => v + 1)}
          monthNavBusy={hoursLoading} />}

        {activeTab === "timeline" && <TimelineTab data={data} />}

        {activeTab === "projects" && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-lg font-semibold">Projects (coming soon)</h2>
            <p className="text-sm text-muted-foreground">
              Project management UI placeholder.
            </p>
          </section>
        )}

        {activeTab === "employees" && (
          <section className="rounded-xl border bg-card p-4 space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Employees</h2>
              <p className="text-sm text-muted-foreground">
                Create employees and send them invite links.
              </p>
            </div>

            <form
              onSubmit={handleCreateEmployee}
              className="grid gap-2 md:grid-cols-[1.2fr,1.5fr,auto]"
            >
              <div>
                <label className="block text-xs font-medium mb-1">Name</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  placeholder="Employee name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none"
                  type="email"
                  value={newEmpEmail}
                  onChange={(e) => setNewEmpEmail(e.target.value)}
                  placeholder="employee@example.com"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" size="sm" disabled={creatingEmployee}>
                  {creatingEmployee ? "Creating…" : "Create & get link"}
                </Button>
              </div>
            </form>

            {createError && (
              <p className="text-sm text-red-600">{createError}</p>
            )}

            {latestInviteUrl && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                <p className="font-medium mb-1">Invite link</p>
                <p className="break-all">{latestInviteUrl}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Copy this link and send it to the employee.
                </p>
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-2">Current employees</h3>
              {employeesLoading && (
                <p className="text-xs text-muted-foreground">Loading…</p>
              )}
              {employeesError && (
                <p className="text-xs text-red-600">{employeesError}</p>
              )}
              {!employeesLoading && employees && employees.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No employees yet.
                </p>
              )}
              {!employeesLoading && employees && employees.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {employees.map((emp) => (
                    <li
                      key={emp.id}
                      className="flex items-center justify-between border-b last:border-0 py-1"
                    >
                      <span>{emp.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
        
      </div>
      </div>
    </main>
  );
}
