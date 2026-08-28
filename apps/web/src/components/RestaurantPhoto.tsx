"use client";

import { useState } from "react";
import { Store } from "lucide-react";

export function RestaurantPhoto({
  src,
  alt,
  className = "",
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 via-slate-100 to-amber-50 text-slate-500 ${className}`}
        aria-hidden="true"
      >
        <span className="absolute -right-3 -top-3 size-12 rounded-full bg-primary/10" />
        <Store className="size-1/3 min-h-4 min-w-4" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
