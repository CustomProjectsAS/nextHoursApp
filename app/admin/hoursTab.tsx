"use client";

import { Button } from "@/components/ui/button";
import type { HoursTabProps } from "@/features/hours/admin/types";
import { EditHourEntryModal } from "@/features/hours/admin/components/EditHourEntryModal";
import { RejectHourEntryModal } from "@/features/hours/admin/components/RejectHourEntryModal";
import { useHoursTab } from "@/features/hours/admin/hooks/useHoursTab";


export function HoursTab({ data, onPrevMonth, onNextMonth, monthNavBusy }: HoursTabProps) {
    const {
        uiData,
        viewData,
        monthTotals,
        empTotals,
        openEmployees,
        busyEntryIds,
        editingEntry,
        editDescription,
        savingEdit,
        search,
        flash,
        setSearch,
        setEditDescription,
        toggleEmployee,
        approve,
        openReject,
        closeReject,
        confirmReject,
        rejectingEntry,
        rejectReason,
        savingReject,
        setRejectReason,
        openEdit,
        closeEdit,
        saveEdit,

    } = useHoursTab(data);



    return (
        <div className="flex h-full flex-col gap-3 overflow-hidden">
            {flash && (
                <div
                    className={`rounded-md border px-3 py-2 text-sm ${flash.type === "error"
                        ? "border-red-200 bg-red-50 text-red-800"
                        : "border-green-200 bg-green-50 text-green-800"
                        }`}
                >
                    {flash.text}
                </div>
            )}
            {/* Summary row */}
            <section className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold">Hours</h2>
                        <p className="text-xs text-muted-foreground">
                            <>
                                Total this month:{" "}
                                <span className="font-medium">{monthTotals.totalNet.toFixed(1)}h net</span>{" "}
                                ({monthTotals.totalBrut.toFixed(1)}h brut) • {monthTotals.entriesCount} entries
                            </>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* nav but 1 */}
                        <Button variant="outline" size="sm" onClick={onPrevMonth} disabled={!!monthNavBusy}>
                            ← Previous
                        </Button>
                        <span className="text-sm font-medium">{uiData.monthLabel}</span>
                        {/* nav but 2 */}
                        <Button variant="outline" size="sm" onClick={onNextMonth} disabled={!!monthNavBusy}>
                            Next →
                        </Button>
                    </div>
                </div>
            </section>
            {/* Search bar */}
            <section className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <input
                    type="text"
                    placeholder="Search by employee, project, description…"
                    className="h-9 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm outline-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {/* export but  */}
                <Button variant="outline" size="sm">
                    Export (later)
                </Button>
            </section>
            {/* Employees + their tables */}
            <div className="flex-1 overflow-auto">
                <section className="space-y-6 rounded-xl border bg-card p-4">
                    {viewData.employees.map((emp) => {
                        const isOpen = openEmployees[emp.id] ?? false;
                        return (
                            <div key={emp.id} className="space-y-2">
                                {/* CLICKABLE HEADER */}
                                <button
                                    type="button"
                                    onClick={() => toggleEmployee(emp.id)}
                                    className="flex w-full items-center justify-between rounded-md px-2 py-2 hover:bg-muted/60"
                                >
                                    <div className="text-left">
                                        <p className="font-semibold">{emp.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {(() => {
                                                const t = empTotals(emp);
                                                return (
                                                    <>
                                                        Total: <span className="font-medium">{t.totalNet.toFixed(1)}h net</span>{" "}
                                                        ({t.totalBrut.toFixed(1)}h brut)
                                                    </>
                                                );
                                            })()}
                                        </p>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {isOpen ? "▲" : "▼"}
                                    </span>
                                </button>
                                {/* DETAILS ONLY IF OPEN */}
                                {isOpen && (
                                    emp.entries.length === 0 ? (
                                        <p className="text-xs italic text-muted-foreground">
                                            No entries for this month.
                                        </p>
                                    ) : (
                                        <div className="overflow-x-auto rounded-lg border bg-background">
                                            <table className="w-full text-sm">
                                                <thead className="sticky top-0 z-10 bg-muted/50 text-xs">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left">Date</th>
                                                        <th className="px-3 py-2 text-left">From→To</th>
                                                        <th className="px-3 py-2 text-left">Break</th>
                                                        <th className="px-3 py-2 text-left">Hours</th>
                                                        <th className="px-3 py-2 text-left">Project</th>
                                                        <th className="px-3 py-2 text-left">Description</th>
                                                        <th className="py-2 pr-3 text-left">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {emp.entries.map((entry) => (
                                                        <tr key={entry.id} className="border-t">
                                                            <td className="px-3 py-2">{entry.date}</td>
                                                            <td className="px-3 py-2">
                                                                {entry.from}–{entry.to}
                                                            </td>
                                                            <td className="px-3 py-2">{entry.breakLabel}</td>
                                                            <td className="px-3 py-2">{entry.hoursNet} h</td>
                                                            <td className="px-3 py-2">
                                                                <span
                                                                    className="rounded-full px-2 py-1 text-white text-xs"
                                                                    style={{ backgroundColor: entry.projectColor }}
                                                                >
                                                                    {entry.projectName}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2">{entry.description}</td>
                                                            <td className="py-2 pr-3 align-top">
                                                                <span
                                                                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium
                                                                        ${entry.status === "approved"
                                                                            ? "bg-green-100 text-green-800 border-green-200"
                                                                            : entry.status === "rejected"
                                                                                ? "bg-red-100 text-red-800 border-red-200"
                                                                                : "bg-yellow-100 text-yellow-800 border-yellow-200"
                                                                        }`}
                                                                >
                                                                    {entry.status === "approved"
                                                                        ? "Approved"
                                                                        : entry.status === "rejected"
                                                                            ? "Rejected"
                                                                            : entry.status === "pendingEmployee"
                                                                                ? "Pending (edited)"
                                                                                : "Pending"}

                                                                </span>
                                                                <div className="mt-2 flex gap-2">
                                                                    {entry.status !== "approved" && (
                                                                        //aprove but
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-7 px-2 text-xs"
                                                                            disabled={!!busyEntryIds[entry.id] || !!editingEntry || savingEdit || !!rejectingEntry || savingReject}
                                                                            onClick={() => approve(entry.id)}

                                                                        >
                                                                            {busyEntryIds[entry.id] ? "Working..." : "Approve"}
                                                                        </Button>
                                                                    )}
                                                                    {(entry.status === "pending" || entry.status === "pendingEmployee") && (
                                                                        //reject btt
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-7 px-2 text-xs"
                                                                            disabled={!!busyEntryIds[entry.id] || !!editingEntry || savingEdit || !!rejectingEntry || savingReject}
                                                                            onClick={() => openReject(entry)}

                                                                        >
                                                                            {busyEntryIds[entry.id] ? "Working..." : "Reject"}
                                                                        </Button>
                                                                    )}
                                                                    {/* Edit Butt */}
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 px-2 text-xs"
                                                                        disabled={!!busyEntryIds[entry.id] || !!editingEntry || savingEdit || !!rejectingEntry || savingReject}

                                                                        onClick={() => openEdit(entry)}

                                                                    >
                                                                        Edit
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )
                                )}
                            </div>
                        );
                    })}
                </section>
            </div>
            <EditHourEntryModal
                entry={editingEntry}
                description={editDescription}
                setDescription={setEditDescription}
                saving={savingEdit}
                onClose={closeEdit}
                onSave={saveEdit}
            />
            <RejectHourEntryModal
                entry={rejectingEntry}
                rejectReason={rejectReason}
                setRejectReason={setRejectReason}
                saving={savingReject}
                onClose={closeReject}
                onConfirm={confirmReject}
            />


        </div>
    );
}