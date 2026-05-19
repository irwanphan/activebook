# EasyBook Activebook

Middleware aktivasi lisensi untuk aplikasi **EasyBook** (Tauri). Dapat di-deploy ke **Vercel** atau **Netlify**.

## Fitur

- **Multi-produk:** `easybook-erp`, `easybook-crm` (dan bisa ditambah di `lib/products.ts`)
- Aktivasi online: `POST /api/activate` dengan `appId`, `invoiceNumber`, `deviceCode`
- Batas per invoice **per produk**: max aktivasi per perangkat & max perangkat berbeda
- Bundle: satu invoice bisa mengizinkan beberapa produk sekaligus
- Histori aktivasi
- Kode aktivasi offline (Ed25519) untuk user tanpa internet
- Form permintaan aktivasi (`/request`) + panel admin (`/admin`)

## Setup lokal

```bash
bun install
cp .env.example .env.local
bun scripts/generate-keys.ts   # isi ACTIVATION_* di .env.local
# Set ADMIN_API_KEY
mkdir -p data
bun dev
```

## Deploy (Vercel)

1. Buat database [Turso](https://turso.tech) (libSQL).
2. Set env: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_API_KEY`, `ACTIVATION_PRIVATE_KEY`, `ACTIVATION_PUBLIC_KEY`.
3. Deploy repo; `ACTIVATION_PUBLIC_KEY` yang sama harus disematkan di EasyBook (Rust).

## API

| Endpoint | Auth | Deskripsi |
|----------|------|-----------|
| `GET /api/products` | - | Daftar produk |
| `POST /api/activate` | - | Aktivasi online (`appId` wajib) |
| `POST /api/activate/offline/confirm` | - | Sinkron histori setelah aktivasi offline |
| `POST /api/request` | - | Form permintaan offline (`appId` wajib) |
| `GET/POST /api/admin/*` | `x-admin-key` | Kelola invoice & generate kode per produk |

## Kode perangkat (EasyBook)

Disarankan: **machine ID OS** di-hash (bukan MAC mentah):

- Windows: MachineGuid
- macOS: IOPlatformUUID
- Linux: `/etc/machine-id`

Format tampilan: `EB-DEV-` + 12 karakter hex (SHA-256).
# activebook
