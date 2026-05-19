import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
        EasyBook Activebook
      </h1>
      <p className="mt-3 text-zinc-600">
        Middleware aktivasi lisensi multi-produk: EasyBook ERP & EasyBook CRM.
      </p>
      <nav className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/request"
          className="rounded-xl border border-zinc-200 px-5 py-3 text-center text-sm font-semibold text-zinc-800"
        >
          Permintaan aktivasi offline
        </Link>
      </nav>
    </div>
  );
}
