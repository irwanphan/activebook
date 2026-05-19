import { Suspense } from "react";
import { RequestForm } from "./RequestForm";

export default function RequestPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-zinc-500">Memuat formulir…</p>}>
      <RequestForm />
    </Suspense>
  );
}
