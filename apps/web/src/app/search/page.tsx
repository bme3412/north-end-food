import { Suspense } from "react";

import { SearchWorkspace } from "@/components/SearchWorkspace";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] animate-pulse bg-linen-2" />}>
      <SearchWorkspace />
    </Suspense>
  );
}
