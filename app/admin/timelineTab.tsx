"use client";

import { useState } from "react";

import type { AdminHoursData } from "./page";

type TimelineTabProps = {
    data: AdminHoursData;
};

type DayInfo = {
    label: string;   // e.g. "Mon 1"
    dateKey: string; // "YYYY-MM-DD"
};

type EmployeeBlock = AdminHoursData["employees"][number];
type TimelineEntry = EmployeeBlock["entries"][number];

// --- helpers ---

function getFirstEntryDate(data: AdminHoursData): Date | null {
    let min: Date | null = null;

    for (const emp of data.employees) {
        for (const entry of emp.entries) {
            const d = new Date(entry.date + "T00:00:00");
            if (!min || d < min) {
                min = d;
            }
        }
    }

    return min;
}

function buildWeekDays(startDate: Date): DayInfo[] {
    const days: DayInfo[] = [];

    for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);

        const dateKey = formatDateKey(d); // local YYYY-MM-DD
        const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
        const dayNum = d.getDate();

        days.push({
            label: `${weekday} ${dayNum}`,
            dateKey,
        });
    }

    return days;
}

function formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`; // YYYY-MM-DD in local time
}


function parseTimeToMinutes(time: string): number | null {
    if (!time) return null;
    const [hStr, mStr] = time.split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    if (
        Number.isNaN(h) ||
        Number.isNaN(m) ||
        h < 0 ||
        h > 23 ||
        m < 0 ||
        m > 59
    ) {
        return null;
    }
    return h * 60 + m;
}

function computeDayRangeForWeek(
    data: AdminHoursData,
    days: DayInfo[],
): { dayStartMin: number; dayEndMin: number } {
    const daySet = new Set(days.map((d) => d.dateKey));

    let minStart: number | null = null;
    let maxEnd: number | null = null;

    for (const emp of data.employees) {
        for (const entry of emp.entries) {
            if (!daySet.has(entry.date)) continue;

            const start = parseTimeToMinutes(entry.from);
            const end = parseTimeToMinutes(entry.to);
            if (start === null || end === null || end <= start) continue;

            if (minStart === null || start < minStart) {
                minStart = start;
            }
            if (maxEnd === null || end > maxEnd) {
                maxEnd = end;
            }
        }
    }

    const DEFAULT_START = 6 * 60; // 06:00
    const DEFAULT_END = 22 * 60;  // 22:00
    const MIN_SPAN = 4 * 60;      // 4 hours
    const PADDING = 30;           // minutes

    if (minStart === null || maxEnd === null) {
        return { dayStartMin: DEFAULT_START, dayEndMin: DEFAULT_END };
    }

    let start = Math.max(0, minStart - PADDING);
    let end = Math.min(24 * 60, maxEnd + PADDING);

    if (end - start < MIN_SPAN) {
        const center = (start + end) / 2;
        start = Math.max(0, center - MIN_SPAN / 2);
        end = Math.min(24 * 60, center + MIN_SPAN / 2);
    }

    return { dayStartMin: start, dayEndMin: end };
}

function computeDayRangeForDate(
    data: AdminHoursData,
    dateKey: string,
): { dayStartMin: number; dayEndMin: number } {
    return computeDayRangeForWeek(data, [{ label: "", dateKey }]);
}

function getEntriesForDay(emp: EmployeeBlock, dateKey: string): TimelineEntry[] {
    return emp.entries.filter((e) => e.date === dateKey);
}


// Build hour labels for the Day view axis – always full 24h (00, 02, 04, ... 22)
function buildHourTicks(): string[] {
    const labels: string[] = [];
    for (let h = 0; h < 24; h += 2) {
        labels.push(h.toString().padStart(2, "0"));
    }
    return labels;
}


// --- component ---

export function TimelineTab({ data }: TimelineTabProps) {
    const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");

    const first = getFirstEntryDate(data);
    const fallbackStart = new Date(data.month + "-01T00:00:00");
    const days = buildWeekDays(first ?? fallbackStart);

    // Week: per-day ranges (each column scales to that day’s min/max)
    const dayRanges = new Map<string, { start: number; end: number; total: number }>();
    for (const d of days) {
        const { dayStartMin, dayEndMin } = computeDayRangeForDate(data, d.dateKey);
        dayRanges.set(d.dateKey, {
            start: dayStartMin,
            end: dayEndMin,
            total: dayEndMin - dayStartMin,
        });
    }

    // Day focus: first day in week that has entries, otherwise days[0]
    const focusDay =
        days.find((d) =>
            data.employees.some((emp) =>
                emp.entries.some((e) => e.date === d.dateKey),
            ),
        ) ?? days[0];

    // Day view: ALWAYS show full 24h range (00:00–24:00)
    const focusDayStartMin = 0;
    const focusDayEndMin = 24 * 60;
    const focusDayTotalMin = focusDayEndMin - focusDayStartMin;
    const hourTicks = buildHourTicks();


    // Month: total net per date
    const totalNetByDate = new Map<string, number>();
    for (const emp of data.employees) {
        for (const e of emp.entries) {
            totalNetByDate.set(
                e.date,
                (totalNetByDate.get(e.date) ?? 0) + (e.hoursNet ?? 0),
            );
        }
    }

    return (
        <section className="rounded-xl border bg-card p-4">
            {/* Header + view switcher */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold">Timeline</h2>
                    <p className="text-xs text-muted-foreground">
                        Total:{" "}
                        <span className="font-medium">
                            {data.totalNet.toFixed(1)}h net
                        </span>{" "}
                        (
                        <span className="font-medium">
                            {data.totalBrut.toFixed(1)}h brut
                        </span>
                        ) • {data.entriesCount} entries
                    </p>
                </div>

                <div className="inline-flex rounded-full border bg-muted/40 p-1 text-xs">
                    {(["day", "week", "month"] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => setViewMode(mode)}
                            className={
                                "rounded-full px-3 py-1 capitalize transition " +
                                (viewMode === mode
                                    ? "bg-background shadow text-foreground"
                                    : "text-muted-foreground hover:bg-background/60")
                            }
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>

            {/* WEEK VIEW */}
            {viewMode === "week" && (
                <div className="overflow-x-auto overflow-y-auto max-h-[480px] rounded-lg border bg-background">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                            <tr>
                                <th className="w-32 py-2 pl-3 pr-2 text-left">Employee</th>
                                {days.map((day) => (
                                    <th key={day.dateKey} className="py-2 px-2 text-center">
                                        {day.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.employees.map((emp) => (
                                <tr key={emp.id} className="border-b last:border-0">
                                    <td className="py-2 pl-3 pr-2 font-medium whitespace-nowrap">
                                        {emp.name}
                                    </td>
                                    {days.map((day) => {
                                        const entries = getEntriesForDay(emp, day.dateKey);
                                        const range = dayRanges.get(day.dateKey);

                                        return (
                                            <td
                                                key={day.dateKey}
                                                className="py-0.5 px-2 text-center text-xs"
                                            >
                                                <div className="relative h-7 w-full overflow-hidden rounded-md bg-muted/40">
                                                    {!range || range.total <= 0
                                                        ? null
                                                        : entries.map((entry) => {
                                                            const start = parseTimeToMinutes(entry.from);
                                                            const end = parseTimeToMinutes(entry.to);
                                                            if (
                                                                start === null ||
                                                                end === null ||
                                                                end <= start
                                                            ) {
                                                                return null;
                                                            }

                                                            const columnStart = range.start;
                                                            const columnEnd = range.end;
                                                            const columnTotal = range.total;

                                                            const clampedStart = Math.max(
                                                                columnStart,
                                                                start,
                                                            );
                                                            const clampedEnd = Math.min(columnEnd, end);
                                                            const span = clampedEnd - clampedStart;
                                                            if (span <= 0 || columnTotal <= 0) return null;

                                                            const leftPct =
                                                                ((clampedStart - columnStart) /
                                                                    columnTotal) *
                                                                100;
                                                            const widthPct =
                                                                (span / columnTotal) * 100;

                                                            return (
                                                                <div
                                                                    key={entry.id}
                                                                    className="absolute inset-y-0 flex items-center justify-start rounded-md border border-black/5 px-2 text-[10px] font-medium leading-none text-white shadow-sm"
                                                                    style={{
                                                                        left: `${leftPct}%`,
                                                                        width: `${Math.max(widthPct, 6)}%`,
                                                                        backgroundColor:
                                                                            entry.projectColor || "#666666",
                                                                    }}
                                                                    title={`${entry.projectName} ${entry.from}–${entry.to} (${entry.hoursNet.toFixed(
                                                                        1,
                                                                    )} h)`}
                                                                >
                                                                    <span className="truncate">
                                                                        {entry.projectName}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* DAY VIEW – full 24h strip + hour grid */}
            {viewMode === "day" && (
                <div className="mt-2 rounded-lg border bg-background px-4 py-3">
                    {/* Header row: EMPLOYEE + hour axis */}
                    <div className="mb-2 flex items-center text-[11px] font-semibold text-muted-foreground">
                        <div className="w-32 uppercase">Employee</div>
                        <div className="relative flex-1">
                            <div className="relative h-4">
                                {hourTicks.map((label) => {
                                    const hour = parseInt(label, 10); // 0, 2, 4, ...
                                    const leftPct = (hour / 24) * 100;

                                    return (
                                        <span
                                            key={label}
                                            className={`absolute tabular-nums ${
                                                hour === 0 ? "" : "-translate-x-1/2"
                                                }`}

                                            style={{ left: `${leftPct}%` }}
                                        >
                                            {label}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>

                    </div>

                    {/* Scrollable list of employees */}
                    <div className="max-h-[480px] overflow-y-auto pr-2">
                        {data.employees.map((emp) => {
                            const entriesForDay = getEntriesForDay(emp, focusDay.dateKey);

                            return (
                                <div
                                    key={emp.id}
                                    className="flex items-center border-t first:border-t-0 py-0.5"
                                >
                                    {/* Name column */}
                                    <div className="w-32 pr-2 text-sm font-medium truncate">
                                        {emp.name}
                                    </div>

                                    {/* Timeline strip */}
                                    <div className="relative h-10 flex-1 overflow-hidden rounded-full bg-muted/60">
                                        <div className="pointer-events-none absolute inset-0">
                                            {hourTicks.map((label, idx) => {
                                                const startHour = parseInt(label, 10); // 0,2,4,...22
                                                const endHour = startHour + 2;
                                                const leftPct = (startHour / 24) * 100;
                                                const widthPct = ((endHour - startHour) / 24) * 100;

                                                // shade every second band for a subtle stripe effect
                                                if (idx % 2 === 1) {
                                                    return (
                                                        <div
                                                            key={`band-${label}`}
                                                            className="absolute inset-y-0 bg-white/80"
                                                            style={{
                                                                left: `${leftPct}%`,
                                                                width: `${widthPct}%`,
                                                            }}
                                                        />
                                                    );
                                                }
                                                return null;
                                            })}
                                        </div>

                                        {/* vertical hour grid (every 2h) */}
                                        <div className="pointer-events-none absolute inset-0">
                                            {hourTicks.map((label, idx) => {
                                                const hour = parseInt(label, 10); // 0,2,4,...22
                                                const leftPct = (hour / 24) * 100;

                                                // skip the very first line at 00 to avoid a heavy left edge
                                                if (idx === 0) return null;

                                                return (
                                                    <div
                                                        key={`grid-${label}`}
                                                        className="absolute inset-y-1 border-l border-black/1"
                                                        style={{ left: `${leftPct}%` }}
                                                    />
                                                );
                                            })}
                                        </div>

                                        {/* pills */}
                                        {entriesForDay.map((entry) => {
                                            const start = parseTimeToMinutes(entry.from);
                                            const end = parseTimeToMinutes(entry.to);
                                            if (start === null || end === null || end <= start) {
                                                return null;
                                            }

                                            const clampedStart = Math.max(focusDayStartMin, start);
                                            const clampedEnd = Math.min(focusDayEndMin, end);
                                            const span = clampedEnd - clampedStart;
                                            if (span <= 0 || focusDayTotalMin <= 0) return null;

                                            const leftPct =
                                                ((clampedStart - focusDayStartMin) / focusDayTotalMin) *
                                                100;
                                            const widthPct = (span / focusDayTotalMin) * 100;

                                            return (
                                                <div
                                                    key={entry.id}
                                                    className="absolute inset-y-0 flex items-center justify-start rounded-lg border border-black/5 px-2 text-[10px] font-medium leading-none text-white shadow-sm"
                                                    style={{
                                                        left: `${leftPct}%`,
                                                        width: `${Math.max(widthPct, 8)}%`,
                                                        backgroundColor: entry.projectColor || "#666666",
                                                    }}
                                                    title={`${entry.projectName} ${entry.from}–${entry.to} (${entry.hoursNet.toFixed(
                                                        1,
                                                    )} h)`}
                                                >
                                                    <span className="truncate">{entry.projectName}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* MONTH VIEW */}
            {viewMode === "month" && (
                <div className="mt-2 overflow-x-auto overflow-y-auto max-h-[480px] rounded-lg border bg-background">
                    {(() => {
                        const [yearStr, monthStr] = data.month.split("-");
                        const year = Number(yearStr);
                        const month = Number(monthStr); // 1–12

                        const first = new Date(year, month - 1, 1);
                        const daysInMonth = new Date(year, month, 0).getDate();

                        // Monday = 0 ... Sunday = 6
                        const firstWeekday = (first.getDay() + 6) % 7;

                        type Cell = {
                            dateKey?: string;
                            dayLabel?: string;
                            totalNet?: number;
                        };

                        const cells: Cell[] = [];

                        // leading blanks
                        for (let i = 0; i < firstWeekday; i++) cells.push({});

                        for (let day = 1; day <= daysInMonth; day++) {
                            const d = new Date(year, month - 1, day);
                            const dateKey = formatDateKey(d); // local YYYY-MM-DD
                            const totalNet = totalNetByDate.get(dateKey) ?? 0;
                            cells.push({
                                dateKey,
                                dayLabel: String(day),
                                totalNet,
                            });
                        }


                        while (cells.length % 7 !== 0) cells.push({});

                        const weeks: Cell[][] = [];
                        for (let i = 0; i < cells.length; i += 7) {
                            weeks.push(cells.slice(i, i + 7));
                        }

                        const weekdayLabels = [
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                            "Sun",
                        ];

                        return (
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 z-10 border-b bg-muted/40">
                                    <tr>
                                        {weekdayLabels.map((lbl) => (
                                            <th
                                                key={lbl}
                                                className="py-2 text-center font-medium text-muted-foreground"
                                            >
                                                {lbl}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {weeks.map((week, wIdx) => (
                                        <tr key={wIdx}>
                                            {week.map((cell, cIdx) => (
                                                <td
                                                    key={cIdx}
                                                    className="h-20 min-w-[90px] border-b border-r p-1 align-top"
                                                >
                                                    {cell.dateKey && (
                                                        <div className="flex h-full flex-col">
                                                            <div className="text-[11px] font-semibold">
                                                                {cell.dayLabel}
                                                            </div>
                                                            {cell.totalNet && cell.totalNet > 0 && (
                                                                <div className="mt-1 text-[10px] text-muted-foreground">
                                                                    {cell.totalNet.toFixed(1)} h
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        );
                    })()}
                </div>
            )}
        </section>
    );
}
