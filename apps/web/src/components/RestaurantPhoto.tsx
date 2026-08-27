"use client";

import { useState } from "react";
import { Utensils } from "lucide-react";

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
        className={`flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 ${className}`}
        aria-hidden="true"
      >
        <Utensils className="size-1/3 min-h-4 min-w-4" strokeWidth={1.5} />
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
