# EasyBook Activebook

Middleware aktivasi lisensi untuk aplikasi **EasyBook** (Tauri). Dapat di-deploy ke **Vercel** atau **Netlify**.

## Fitur

- Aktivasi online: `POST /api/activate` (invoice + kode perangkat)
- Batas per invoice: max aktivasi per perangkat & max perangkat berbeda
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
| `POST /api/activate` | - | Aktivasi online |
| `POST /api/activate/offline/confirm` | - | Sinkron histori setelah aktivasi offline di klien |
| `POST /api/request` | - | Form permintaan offline |
| `GET/POST /api/admin/*` | `x-admin-key` | Kelola invoice & generate kode |

## Kode perangkat (EasyBook)

Disarankan: **machine ID OS** di-hash (bukan MAC mentah):

- Windows: MachineGuid
- macOS: IOPlatformUUID
- Linux: `/etc/machine-id`

Format tampilan: `EB-DEV-` + 12 karakter hex (SHA-256).
# activebook
