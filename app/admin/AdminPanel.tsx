"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Card } from "@/components/ui/Card";

type PermittedInvoice = {
  id: string;
  invoiceNumber: string;
  maxActivationsPerDevice: number;
  maxDevices: number;
  notes: string | null;
  active: number;
  createdAt: number;
};

type HistoryRow = {
  id: string;
  invoiceNumber: string;
  deviceCode: string;
  method: string;
  status: string;
  message: string | null;
  createdAt: number;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200";

export function AdminPanel() {
  const [adminKey, setAdminKey] = useState("");
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<PermittedInvoice[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newInvoice, setNewInvoice] = useState("");
  const [maxPerDevice, setMaxPerDevice] = useState(1);
  const [maxDevices, setMaxDevices] = useState(1);

  const [offlineInvoice, setOfflineInvoice] = useState("");
  const [offlineDevice, setOfflineDevice] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const headers = useCallback(
    () => ({ "Content-Type": "application/json", "x-admin-key": storedKey ?? "" }),
    [storedKey],
  );

  const loadData = useCallback(async () => {
    if (!storedKey) return;
    setError(null);
    const [invRes, histRes] = await Promise.all([
      fetch("/api/admin/permitted-invoices", { headers: headers() }),
      fetch("/api/admin/activation-history?limit=50", { headers: headers() }),
    ]);
    if (!invRes.ok || !histRes.ok) {
      setError("Gagal memuat data. Periksa kunci admin.");
      return;
    }
    const invJson = (await invRes.json()) as { items: PermittedInvoice[] };
    const histJson = (await histRes.json()) as { items: HistoryRow[] };
    setInvoices(invJson.items);
    setHistory(histJson.items);
  }, [storedKey, headers]);

  useEffect(() => {
    const saved = window.sessionStorage.getItem("activebook_admin_key");
    if (saved) setStoredKey(saved);
  }, []);

  useEffect(() => {
    if (storedKey) void loadData();
  }, [storedKey, loadData]);

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    window.sessionStorage.setItem("activebook_admin_key", adminKey.trim());
    setStoredKey(adminKey.trim());
  }

  async function handleAddInvoice(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const res = await fetch("/api/admin/permitted-invoices", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        invoiceNumber: newInvoice,
        maxActivationsPerDevice: maxPerDevice,
        maxDevices,
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Gagal menambah invoice.");
      return;
    }
    setNewInvoice("");
    setMessage("Invoice permitted berhasil ditambahkan.");
    await loadData();
  }

  async function handleGenerateOffline(e: FormEvent) {
    e.preventDefault();
    setGeneratedCode(null);
    setError(null);
    const res = await fetch("/api/admin/offline-code", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        invoiceNumber: offlineInvoice,
        deviceCode: offlineDevice,
      }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      activationCode?: string;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      setError(json.message ?? json.error ?? "Gagal membuat kode.");
      return;
    }
    setGeneratedCode(json.activationCode ?? null);
    setMessage("Kode aktivasi offline berhasil dibuat.");
    await loadData();
  }

  if (!storedKey) {
    return (
      <Card className="max-w-md mx-auto mt-16">
        <h1 className="text-xl font-semibold text-zinc-900">Admin Aktivasi</h1>
        <p className="mt-2 text-sm text-zinc-600">Masukkan kunci admin API.</p>
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-700">Admin API Key</label>
            <input
              type="password"
              className={inputClass}
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white"
          >
            Masuk
          </button>
        </form>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">EasyBook Activebook</h1>
          <p className="text-sm text-zinc-600">Kelola invoice, histori, dan kode aktivasi offline.</p>
        </div>
        <button
          type="button"
          className="text-sm text-zinc-500 underline"
          onClick={() => {
            window.sessionStorage.removeItem("activebook_admin_key");
            setStoredKey(null);
          }}
        >
          Keluar
        </button>
      </header>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {message && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-zinc-900">Tambah permitted invoice</h2>
          <form onSubmit={handleAddInvoice} className="mt-4 space-y-3">
            <div>
              <label className="text-sm font-medium">Nomor invoice</label>
              <input
                className={inputClass}
                value={newInvoice}
                onChange={(e) => setNewInvoice(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Max / perangkat</label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={maxPerDevice}
                  onChange={(e) => setMaxPerDevice(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Max perangkat beda</label>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={maxDevices}
                  onChange={(e) => setMaxDevices(Number(e.target.value))}
                />
              </div>
            </div>
            <button
              type="submit"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Simpan
            </button>
          </form>
        </Card>

        <Card>
          <h2 className="font-semibold text-zinc-900">Generate kode offline</h2>
          <form onSubmit={handleGenerateOffline} className="mt-4 space-y-3">
            <div>
              <label className="text-sm font-medium">Invoice</label>
              <input
                className={inputClass}
                value={offlineInvoice}
                onChange={(e) => setOfflineInvoice(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kode perangkat</label>
              <input
                className={inputClass}
                value={offlineDevice}
                onChange={(e) => setOfflineDevice(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Generate
            </button>
          </form>
          {generatedCode && (
            <div className="mt-4 rounded-xl bg-zinc-50 p-3">
              <p className="text-xs font-medium text-zinc-500">Kode aktivasi</p>
              <p className="mt-1 break-all font-mono text-sm text-zinc-900">{generatedCode}</p>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-zinc-900">Daftar permitted invoice</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-zinc-500">
                <th className="py-2 pr-4">Invoice</th>
                <th className="py-2 pr-4">Max/device</th>
                <th className="py-2 pr-4">Max devices</th>
                <th className="py-2">Aktif</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-4 font-mono">{row.invoiceNumber}</td>
                  <td className="py-2 pr-4">{row.maxActivationsPerDevice}</td>
                  <td className="py-2 pr-4">{row.maxDevices}</td>
                  <td className="py-2">{row.active ? "Ya" : "Tidak"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-zinc-900">Histori aktivasi</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-zinc-500">
                <th className="py-2 pr-3">Waktu</th>
                <th className="py-2 pr-3">Invoice</th>
                <th className="py-2 pr-3">Device</th>
                <th className="py-2 pr-3">Metode</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-3 whitespace-nowrap text-zinc-600">
                    {new Date(row.createdAt).toLocaleString("id-ID")}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{row.invoiceNumber}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{row.deviceCode}</td>
                  <td className="py-2 pr-3">{row.method}</td>
                  <td className="py-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
