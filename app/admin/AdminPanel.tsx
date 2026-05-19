"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { setAdminSession, useAdminSession } from "@/lib/auth/admin-session";

type Product = { id: string; code: string; name: string };

type InvoiceProduct = {
  productId: string;
  productName: string;
  maxActivationsPerDevice: number;
  maxDevices: number;
  activationCount: number;
  distinctDeviceCount: number;
};

type PermittedInvoice = {
  id: string;
  invoiceNumber: string;
  notes: string | null;
  active: number;
  createdAt: number;
  products: InvoiceProduct[];
};

type ProductLimits = {
  maxActivationsPerDevice: number;
  maxDevices: number;
};

type HistoryRow = {
  id: string;
  productId: string;
  productName: string;
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
  const storedKey = useAdminSession();
  const [adminKey, setAdminKey] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [filterAppId, setFilterAppId] = useState<string>("");
  const [invoices, setInvoices] = useState<PermittedInvoice[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newInvoice, setNewInvoice] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Record<string, boolean>>({
    "easybook-erp": true,
    "easybook-crm": false,
  });
  const [maxPerDevice, setMaxPerDevice] = useState(1);
  const [maxDevices, setMaxDevices] = useState(1);

  const [offlineAppId, setOfflineAppId] = useState("easybook-erp");
  const [offlineInvoice, setOfflineInvoice] = useState("");
  const [offlineDevice, setOfflineDevice] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [addInvoiceModalOpen, setAddInvoiceModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [offlineModalError, setOfflineModalError] = useState<string | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editInvoiceModalOpen, setEditInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<PermittedInvoice | null>(null);
  const [editLines, setEditLines] = useState<Record<string, ProductLimits>>({});
  const [editNewProducts, setEditNewProducts] = useState<Record<string, boolean>>({});
  const [editNewMaxPerDevice, setEditNewMaxPerDevice] = useState(1);
  const [editNewMaxDevices, setEditNewMaxDevices] = useState(1);
  const [editModalError, setEditModalError] = useState<string | null>(null);

  const headers = useCallback(
    () => ({ "Content-Type": "application/json", "x-admin-key": storedKey ?? "" }),
    [storedKey],
  );

  const loadInvoices = useCallback(async () => {
    if (!storedKey) return false;
    const q = filterAppId ? `?appId=${encodeURIComponent(filterAppId)}` : "";
    const res = await fetch(`/api/admin/permitted-invoices${q}`, { headers: headers() });
    if (!res.ok) {
      setError("Gagal memuat data. Periksa kunci admin.");
      return false;
    }
    const json = (await res.json()) as { items: PermittedInvoice[] };
    setInvoices(json.items);
    setError(null);
    return true;
  }, [storedKey, headers, filterAppId]);

  const loadHistory = useCallback(async () => {
    if (!storedKey) return false;
    const res = await fetch(
      `/api/admin/activation-history?limit=50${filterAppId ? `&appId=${filterAppId}` : ""}`,
      { headers: headers() },
    );
    if (!res.ok) return false;
    const json = (await res.json()) as { items: HistoryRow[] };
    setHistory(json.items);
    return true;
  }, [storedKey, headers, filterAppId]);

  const loadData = useCallback(async () => {
    await Promise.all([loadInvoices(), loadHistory()]);
  }, [loadInvoices, loadHistory]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { items: Product[] } | null) => {
        if (!cancelled && json) setProducts(json.items);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storedKey) return;
    let cancelled = false;
    const q = filterAppId ? `?appId=${encodeURIComponent(filterAppId)}` : "";
    fetch(`/api/admin/permitted-invoices${q}`, { headers: headers() })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("fetch failed"))))
      .then((json: { items: PermittedInvoice[] }) => {
        if (!cancelled) {
          setInvoices(json.items);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat data. Periksa kunci admin.");
      });
    return () => {
      cancelled = true;
    };
  }, [storedKey, filterAppId, headers]);

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAdminSession(adminKey.trim());
  }

  function toggleProduct(productId: string) {
    setSelectedProducts((prev) => ({ ...prev, [productId]: !prev[productId] }));
  }

  function resetAddInvoiceForm() {
    setNewInvoice("");
    setSelectedProducts({ "easybook-erp": true, "easybook-crm": false });
    setMaxPerDevice(1);
    setMaxDevices(1);
    setModalError(null);
  }

  function openAddInvoiceModal() {
    resetAddInvoiceForm();
    setAddInvoiceModalOpen(true);
  }

  function closeAddInvoiceModal() {
    setAddInvoiceModalOpen(false);
    setModalError(null);
  }

  function openEditInvoiceModal(invoice: PermittedInvoice) {
    const lines: Record<string, ProductLimits> = {};
    for (const p of invoice.products) {
      lines[p.productId] = {
        maxActivationsPerDevice: p.maxActivationsPerDevice,
        maxDevices: p.maxDevices,
      };
    }
    const newProducts: Record<string, boolean> = {};
    for (const p of products) {
      if (!invoice.products.some((ip) => ip.productId === p.id)) {
        newProducts[p.id] = false;
      }
    }
    setEditingInvoice(invoice);
    setEditLines(lines);
    setEditNewProducts(newProducts);
    setEditNewMaxPerDevice(1);
    setEditNewMaxDevices(1);
    setEditModalError(null);
    setEditInvoiceModalOpen(true);
  }

  function closeEditInvoiceModal() {
    setEditInvoiceModalOpen(false);
    setEditingInvoice(null);
    setEditModalError(null);
  }

  function updateEditLine(productId: string, field: keyof ProductLimits, value: number) {
    setEditLines((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }));
  }

  function toggleEditNewProduct(productId: string) {
    setEditNewProducts((prev) => ({ ...prev, [productId]: !prev[productId] }));
  }

  async function handleEditInvoiceProducts(e: FormEvent) {
    e.preventDefault();
    if (!editingInvoice) return;
    setMessage(null);
    setError(null);
    setEditModalError(null);

    const existingLines = Object.entries(editLines).map(([productId, limits]) => ({
      productId,
      maxActivationsPerDevice: limits.maxActivationsPerDevice,
      maxDevices: limits.maxDevices,
    }));

    const addedLines = Object.entries(editNewProducts)
      .filter(([, on]) => on)
      .map(([productId]) => ({
        productId,
        maxActivationsPerDevice: editNewMaxPerDevice,
        maxDevices: editNewMaxDevices,
      }));

    const productLines = [...existingLines, ...addedLines];
    if (productLines.length === 0) {
      setEditModalError("Invoice harus memiliki minimal satu produk.");
      return;
    }

    const res = await fetch("/api/admin/permitted-invoices", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        invoiceNumber: editingInvoice.invoiceNumber,
        products: productLines,
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setEditModalError(json.error ?? "Gagal menyimpan perubahan.");
      return;
    }
    closeEditInvoiceModal();
    setMessage(`Limit aktivasi untuk ${editingInvoice.invoiceNumber} berhasil diperbarui.`);
    await loadInvoices();
  }

  async function handleAddInvoice(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setModalError(null);

    const productLines = Object.entries(selectedProducts)
      .filter(([, on]) => on)
      .map(([productId]) => ({
        productId,
        maxActivationsPerDevice: maxPerDevice,
        maxDevices,
      }));

    if (productLines.length === 0) {
      setModalError("Pilih minimal satu produk.");
      return;
    }

    const res = await fetch("/api/admin/permitted-invoices", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        invoiceNumber: newInvoice,
        products: productLines,
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setModalError(json.error ?? "Gagal menambah invoice.");
      return;
    }
    closeAddInvoiceModal();
    setMessage("Invoice permitted berhasil ditambahkan.");
    await loadData();
  }

  function resetOfflineForm() {
    setOfflineAppId(filterAppId || "easybook-erp");
    setOfflineInvoice("");
    setOfflineDevice("");
    setGeneratedCode(null);
    setOfflineModalError(null);
  }

  function openOfflineModal() {
    resetOfflineForm();
    setOfflineModalOpen(true);
  }

  function closeOfflineModal() {
    setOfflineModalOpen(false);
    setOfflineModalError(null);
  }

  async function openHistoryModal() {
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    const ok = await loadHistory();
    setHistoryLoading(false);
    if (!ok) setError("Gagal memuat histori aktivasi.");
  }

  function closeHistoryModal() {
    setHistoryModalOpen(false);
  }

  async function handleGenerateOffline(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setOfflineModalError(null);
    const res = await fetch("/api/admin/offline-code", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        appId: offlineAppId,
        invoiceNumber: offlineInvoice,
        deviceCode: offlineDevice,
      }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      activationCode?: string;
      appId?: string;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      setOfflineModalError(json.message ?? json.error ?? "Gagal membuat kode.");
      return;
    }
    setGeneratedCode(json.activationCode ?? null);
    setMessage(`Kode offline untuk ${json.appId ?? offlineAppId} berhasil dibuat.`);
    await loadData();
  }

  if (!storedKey) {
    return (
      <Card className="mx-auto mt-16 max-w-md">
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
    <div className="mx-auto w-full max-w-7xl flex flex-col gap-8 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">EasyBook Activebook</h1>
          <p className="text-sm text-zinc-600">
            Middleware aktivasi multi-produk (ERP, CRM, …).
          </p>
        </div>
        <button
          type="button"
          className="text-sm text-zinc-500 underline cursor-pointer"
          onClick={() => setAdminSession(null)}
        >
          Keluar
        </button>
      </header>

      <div className="flex flex-wrap items-end gap-3 w-full justify-between">
        <div>
          <label className="text-sm font-medium text-zinc-700">Filter produk</label>
          <select
            className={inputClass}
            value={filterAppId}
            onChange={(e) => setFilterAppId(e.target.value)}
          >
            <option value="">Semua produk</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={openAddInvoiceModal}
            className="cursor-pointer rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Tambah permitted invoice
          </button>
          <button
            type="button"
            onClick={openOfflineModal}
            className="cursor-pointer rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Generate kode offline
          </button>
          <button
            type="button"
            onClick={() => void openHistoryModal()}
            className="cursor-pointer rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Histori aktivasi
          </button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {message && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>
      )}


      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-zinc-900">Daftar permitted invoice</h2>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-zinc-500">
                <th className="py-2 pr-4">Invoice</th>
                <th className="py-2 pr-4">Produk</th>
                <th className="py-2 pr-4">Aktif</th>
                <th className="py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 align-top">
                  <td className="py-2 pr-4 font-mono">{row.invoiceNumber}</td>
                  <td className="py-2 pr-4">
                    <ul className="space-y-1">
                      {row.products.map((p) => (
                        <li key={p.productId} className="text-xs">
                          <span className="font-medium">{p.productName}</span>
                          <span className="text-zinc-500">
                            {" "}
                            — {p.maxActivationsPerDevice}/device, {p.maxDevices} devices
                          </span>
                          <span className="mt-0.5 block text-zinc-600">
                            Terpakai: {p.activationCount} aktivasi sukses · {p.distinctDeviceCount}{" "}
                            perangkat
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="py-2 pr-4">{row.active ? "Ya" : "Tidak"}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => openEditInvoiceModal(row)}
                      className="cursor-pointer text-xs font-medium text-zinc-600 underline hover:text-zinc-900"
                    >
                      Kelola limit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={editInvoiceModalOpen}
        title="Kelola limit aktivasi"
        onClose={closeEditInvoiceModal}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeEditInvoiceModal}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Batal
            </button>
            <button
              type="submit"
              form="edit-invoice-products-form"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Simpan
            </button>
          </div>
        }
      >
        <form id="edit-invoice-products-form" onSubmit={handleEditInvoiceProducts} className="space-y-5">
          {editModalError ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{editModalError}</p>
          ) : null}
          {editingInvoice ? (
            <p className="text-sm text-zinc-600">
              Invoice:{" "}
              <span className="font-mono font-medium text-zinc-900">{editingInvoice.invoiceNumber}</span>
            </p>
          ) : null}

          {Object.keys(editLines).length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-700">Produk terdaftar</p>
              {Object.entries(editLines).map(([productId, limits]) => {
                const productName =
                  editingInvoice?.products.find((p) => p.productId === productId)?.productName ??
                  products.find((p) => p.id === productId)?.name ??
                  productId;
                return (
                  <div
                    key={productId}
                    className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 space-y-2"
                  >
                    <p className="text-sm font-medium text-zinc-900">
                      {productName}
                      <span className="ml-1 font-mono text-xs font-normal text-zinc-400">
                        ({productId})
                      </span>
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-zinc-600">Max / perangkat</label>
                        <input
                          type="number"
                          min={1}
                          className={inputClass}
                          value={limits.maxActivationsPerDevice}
                          onChange={(e) =>
                            updateEditLine(
                              productId,
                              "maxActivationsPerDevice",
                              Number(e.target.value),
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-600">Max perangkat beda</label>
                        <input
                          type="number"
                          min={1}
                          className={inputClass}
                          value={limits.maxDevices}
                          onChange={(e) =>
                            updateEditLine(productId, "maxDevices", Number(e.target.value))
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {Object.keys(editNewProducts).length > 0 ? (
            <div className="space-y-3 border-t border-zinc-100 pt-4">
              <p className="text-sm font-medium text-zinc-700">Tambah produk</p>
              <div className="space-y-2">
                {Object.keys(editNewProducts).map((productId) => {
                  const product = products.find((p) => p.id === productId);
                  return (
                    <label key={productId} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editNewProducts[productId] ?? false}
                        onChange={() => toggleEditNewProduct(productId)}
                      />
                      {product?.name ?? productId}
                      <span className="font-mono text-xs text-zinc-400">({productId})</span>
                    </label>
                  );
                })}
              </div>
              {Object.values(editNewProducts).some(Boolean) ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-600">Max / perangkat (produk baru)</label>
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={editNewMaxPerDevice}
                      onChange={(e) => setEditNewMaxPerDevice(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600">
                      Max perangkat beda (produk baru)
                    </label>
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={editNewMaxDevices}
                      onChange={(e) => setEditNewMaxDevices(Number(e.target.value))}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={addInvoiceModalOpen}
        title="Tambah permitted invoice"
        onClose={closeAddInvoiceModal}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeAddInvoiceModal}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Batal
            </button>
            <button
              type="submit"
              form="add-permitted-invoice-form"
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Simpan
            </button>
          </div>
        }
      >
        <form id="add-permitted-invoice-form" onSubmit={handleAddInvoice} className="space-y-4">
          {modalError ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{modalError}</p>
          ) : null}
          <div>
            <label className="text-sm font-medium text-zinc-700">Nomor invoice</label>
            <input
              className={inputClass}
              value={newInvoice}
              onChange={(e) => setNewInvoice(e.target.value)}
              placeholder="INV-2026-001"
              required
              autoFocus
            />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-700">Produk yang diizinkan</p>
            <div className="mt-2 space-y-2">
              {products.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedProducts[p.id] ?? false}
                    onChange={() => toggleProduct(p.id)}
                  />
                  {p.name}
                  <span className="font-mono text-xs text-zinc-400">({p.id})</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-zinc-700">Max / perangkat</label>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={maxPerDevice}
                onChange={(e) => setMaxPerDevice(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">Max perangkat beda</label>
              <input
                type="number"
                min={1}
                className={inputClass}
                value={maxDevices}
                onChange={(e) => setMaxDevices(Number(e.target.value))}
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={offlineModalOpen}
        title="Generate kode offline"
        onClose={closeOfflineModal}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeOfflineModal}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              {generatedCode ? "Tutup" : "Batal"}
            </button>
            {!generatedCode ? (
              <button
                type="submit"
                form="generate-offline-form"
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Generate
              </button>
            ) : null}
          </div>
        }
      >
        <form id="generate-offline-form" onSubmit={handleGenerateOffline} className="space-y-4">
          {offlineModalError ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{offlineModalError}</p>
          ) : null}
          <div>
            <label className="text-sm font-medium text-zinc-700">Produk</label>
            <select
              className={inputClass}
              value={offlineAppId}
              onChange={(e) => setOfflineAppId(e.target.value)}
              required
              autoFocus
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Invoice</label>
            <input
              className={inputClass}
              value={offlineInvoice}
              onChange={(e) => setOfflineInvoice(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Kode perangkat</label>
            <input
              className={inputClass}
              value={offlineDevice}
              onChange={(e) => setOfflineDevice(e.target.value)}
              required
            />
          </div>
          {generatedCode ? (
            <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
              <p className="text-xs font-medium text-emerald-800">Kode aktivasi</p>
              <p className="mt-1 break-all font-mono text-sm text-emerald-950">{generatedCode}</p>
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        open={historyModalOpen}
        title="Histori aktivasi"
        onClose={closeHistoryModal}
        panelClassName="max-w-5xl"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={closeHistoryModal}
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Tutup
            </button>
          </div>
        }
      >
        {historyLoading ? (
          <p className="py-8 text-center text-sm text-zinc-500">Memuat histori…</p>
        ) : history.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">Belum ada aktivasi tercatat.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-zinc-500">
                  <th className="py-2 pr-3">Waktu</th>
                  <th className="py-2 pr-3">Produk</th>
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
                    <td className="py-2 pr-3 text-xs">{row.productName}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.invoiceNumber}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.deviceCode}</td>
                    <td className="py-2 pr-3">{row.method}</td>
                    <td className="py-2">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
