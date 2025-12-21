"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminHourEntry, AdminEmployeeHours, AdminHoursData } from "@/features/hours/admin/types";
import {
  approveHourEntry,
  rejectHourEntry,
  updateHourEntry,
  normalizeStatus,
} from "@/features/hours/admin/services/hoursAdminApi";

export function useHoursTab(data: AdminHoursData) {
  const [openEmployees, setOpenEmployees] = useState<Record<number, boolean>>({});
  const [busyEntryIds, setBusyEntryIds] = useState<Record<number, boolean>>({});
  const [editingEntry, setEditingEntry] = useState<AdminHourEntry | null>(null);
  const [uiData, setUiData] = useState<AdminHoursData>(data);
  useEffect(() => setUiData(data), [data]);
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [flash, setFlash] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rejectingEntry, setRejectingEntry] = useState<AdminHourEntry | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [savingReject, setSavingReject] = useState(false);


  function showError(text: string) {
    setFlash({ type: "error", text });
    window.setTimeout(() => setFlash(null), 5000);
  }

  function showSuccess(text: string) {
    setFlash({ type: "success", text });
    window.setTimeout(() => setFlash(null), 2500);
  }

  useEffect(() => {
    if (editingEntry) setEditDescription(editingEntry.description ?? "");
  }, [editingEntry]);

  function toggleEmployee(id: number) {
    setOpenEmployees((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function updateEntryInUi(entryId: number, patch: Partial<AdminHourEntry>) {
    setUiData((prev) => ({
      ...prev,
      employees: prev.employees.map((emp) => ({
        ...emp,
        entries: emp.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)),
      })),
    }));
  }

  function empTotals(emp: AdminEmployeeHours) {
    const totalNet = emp.entries.reduce((sum, e) => sum + (Number(e.hoursNet) || 0), 0);
    const totalBrut = totalNet;
    return { totalNet, totalBrut };
  }

  const monthTotals = useMemo(() => {
    const entriesCount = uiData.employees.reduce((sum, emp) => sum + emp.entries.length, 0);
    const totalNet = uiData.employees.reduce((sum, emp) => sum + empTotals(emp).totalNet, 0);
    const totalBrut = totalNet;
    return { totalNet, totalBrut, entriesCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiData]);

  const viewData = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return uiData;

    return {
      ...uiData,
      employees: uiData.employees
        .map((emp) => {
          const empMatch = emp.name.toLowerCase().includes(q);
          const entries = emp.entries.filter((e) => {
            const text = [
              emp.name,
              e.projectName,
              e.description,
              e.date,
              e.from,
              e.to,
              e.breakLabel,
              e.status,
            ]
              .join(" ")
              .toLowerCase();
            return empMatch || text.includes(q);
          });
          return { ...emp, entries };
        })
        .filter((emp) => emp.entries.length > 0 || emp.name.toLowerCase().includes(q)),
    };
  }, [search, uiData]);

  async function approve(entryId: number) {
    setBusyEntryIds((m) => ({ ...m, [entryId]: true }));
    try {
      const result = await approveHourEntry(entryId);
      if (!result.ok) {
        showError(`Approve failed: ${result.error}`);
        return;
      }
      updateEntryInUi(entryId, {
        status: normalizeStatus(result.data?.status ?? "approved"),
      });
      showSuccess("Approved.");
    } finally {
      setBusyEntryIds((m) => ({ ...m, [entryId]: false }));
    }
  }

  function openReject(entry: AdminHourEntry) {
    setRejectingEntry(entry);
    setRejectReason("");
  }

  function closeReject() {
    if (!savingReject) setRejectingEntry(null);
  }

  async function confirmReject() {
    if (!rejectingEntry) {
      showError("Reject failed: no entry selected.");
      return;
    }

    const reason = rejectReason.trim();
    if (!reason) {
      showError("Reject reason is required.");
      return;
    }

    setSavingReject(true);
    setBusyEntryIds((m) => ({ ...m, [rejectingEntry.id]: true }));

    try {
      const result = await rejectHourEntry(rejectingEntry.id, reason);
      if (!result.ok) {
        showError(`Reject failed: ${result.error}`);
        return;
      }

      updateEntryInUi(rejectingEntry.id, {
        status: normalizeStatus(result.data?.status ?? "rejected"),
      });

      showSuccess("Rejected.");
      setRejectingEntry(null);
    } finally {
      setSavingReject(false);
      setBusyEntryIds((m) => ({ ...m, [rejectingEntry.id]: false }));
    }
  }


  function openEdit(entry: AdminHourEntry) {
    setEditingEntry(entry);
  }

  function closeEdit() {
    if (!savingEdit) setEditingEntry(null);
  }

  async function saveEdit() {
    if (!editingEntry) {
      showError("Save failed: no entry selected.");
      return;
    }

    setSavingEdit(true);
    try {
      const result = await updateHourEntry(editingEntry.id, { description: editDescription });

      if (!result.ok) {
        showError(`Save failed: ${result.error}`);
        return;
      }

      updateEntryInUi(editingEntry.id, {
        description: String(result.data?.description ?? editDescription),
        status: normalizeStatus(result.data?.status ?? editingEntry.status),
      });

      showSuccess("Saved.");
      setEditingEntry(null);
    } finally {
      setSavingEdit(false);
    }
  }

  return {
    // data
    uiData,
    viewData,

    // derived
    monthTotals,
    empTotals,

    // ui state
    openEmployees,
    busyEntryIds,
    editingEntry,
    editDescription,
    savingEdit,
    search,
    flash,

    // setters/actions
    setSearch,
    setEditDescription,
    toggleEmployee,
    approve,
    rejectingEntry,
    rejectReason,
    savingReject,
    setRejectReason,
    openReject,
    closeReject,
    confirmReject,
    openEdit,
    closeEdit,
    saveEdit,
  };
}
