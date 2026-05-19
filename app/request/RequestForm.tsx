"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";

type Product = { id: string; name: string };

const inputClass =
  "mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200";

export function RequestForm() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [appId, setAppId] = useState("easybook-erp");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [deviceCode, setDeviceCode] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const whatsappUrl = process.env.NEXT_PUBLIC_WHATSAPP_URL;

  useEffect(() => {
    const fromUrl = searchParams.get("appId");
    if (fromUrl) setAppId(fromUrl);
    void fetch("/api/products")
      .then((r) => r.json())
      .then((j: { items: Product[] }) => setProducts(j.items));
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId,
          invoiceNumber,
          deviceCode,
          contactName,
          contactPhone,
          notes,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok) {
        setError(json.message ?? "Gagal mengirim permintaan.");
        return;
      }
      setMessage(json.message ?? "Permintaan terkirim.");
      setInvoiceNumber("");
      setDeviceCode("");
      setContactName("");
      setContactPhone("");
      setNotes("");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  const productName = products.find((p) => p.id === appId)?.name ?? appId;
  const waText = encodeURIComponent(
    `Halo, saya ingin aktivasi offline ${productName}.\nProduk: ${appId}\nInvoice: ${invoiceNumber}\nKode perangkat: ${deviceCode}`,
  );
  const waHref = whatsappUrl
    ? `${whatsappUrl}${whatsappUrl.includes("?") ? "&" : "?"}text=${waText}`
    : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Card>
        <h1 className="text-xl font-semibold text-zinc-900">Permintaan aktivasi offline</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Isi formulir untuk <strong>{productName}</strong>. Reseller/CS akan mengirimkan kode
          aktivasi.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-700">Aplikasi *</label>
            <select
              className={inputClass}
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              required
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Nomor invoice *</label>
            <input
              className={inputClass}
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Kode perangkat *</label>
            <input
              className={inputClass}
              value={deviceCode}
              onChange={(e) => setDeviceCode(e.target.value)}
              placeholder="EB-DEV-… dari aplikasi"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Nama kontak</label>
            <input
              className={inputClass}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Telepon / WhatsApp</label>
            <input
              className={inputClass}
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Catatan</label>
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Mengirim…" : "Kirim permintaan"}
          </button>
        </form>

        {waHref && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-800"
          >
            Atau hubungi via WhatsApp
          </a>
        )}
      </Card>
    </div>
  );
}
