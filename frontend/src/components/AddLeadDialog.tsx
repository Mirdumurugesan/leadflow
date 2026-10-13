"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { Modal } from "./Modal";

interface Props {
  onClose: () => void;
  onCreated: (lead: Lead) => void;
}

const field =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function AddLeadDialog({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const lead = await api.createLead({
        name: name.trim(),
        company: company.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      onCreated(lead);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <Modal
      labelledBy="add-lead-title"
      title={<h2 className="text-lg font-semibold text-slate-900">Add New Lead</h2>}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="submit"
            form="add-lead-form"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Lead"}
          </button>
        </div>
      }
    >
      <form id="add-lead-form" onSubmit={submit} className="space-y-4 px-6 py-5" noValidate>
        <label className="block text-sm font-medium text-slate-800">
          Full Name <span className="text-rose-500">*</span>
          <input
            data-autofocus
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Priya Raman"
            maxLength={120}
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Company <span className="font-normal text-slate-400">(Optional)</span>
          <input className={field} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g., Zenith Wealth Advisors" maxLength={120} />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Phone <span className="font-normal text-slate-400">(Optional)</span>
          <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g., 98400 11223" type="tel" maxLength={40} />
        </label>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      </form>
    </Modal>
  );
}
