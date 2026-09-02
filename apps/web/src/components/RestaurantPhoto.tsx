"use client";

import Image from "next/image";
import { Store } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getGooglePhoto } from "@/lib/api";
import type { GooglePhoto } from "@/lib/types";

type Variant = "thumbnail" | "card" | "hero";
type RemoteState = { key: string; status: "idle" | "loading" | "loaded" | "failed"; photo: GooglePhoto | null };

export function RestaurantPhoto({ restaurantId, localSrc, alt, variant = "card", allowGoogle = true, showSourceLink = true, className = "" }: {
  restaurantId: string;
  localSrc: string | null;
  alt: string;
  variant?: Variant;
  allowGoogle?: boolean;
  showSourceLink?: boolean;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const requestedRef = useRef<string | null>(null);
  const [localFailed, setLocalFailed] = useState(false);
  const [remote, setRemote] = useState<RemoteState>({ key: "", status: "idle", photo: null });
  const requestKey = `${restaurantId}:${variant}`;
  const useLocal = Boolean(localSrc) && !localFailed;
  const shouldLoadGoogle = allowGoogle && !useLocal;
  const currentRemote = remote.key === requestKey ? remote : { key: requestKey, status: "idle" as const, photo: null };

  useEffect(() => {
    if (!shouldLoadGoogle || requestedRef.current === requestKey) return;
    const controller = new AbortController();
    const load = () => {
      if (requestedRef.current === requestKey) return;
      requestedRef.current = requestKey;
      setRemote({ key: requestKey, status: "loading", photo: null });
      getGooglePhoto(restaurantId, variant, controller.signal)
        .then((photo) => setRemote({ key: requestKey, status: "loaded", photo }))
        .catch(() => setRemote({ key: requestKey, status: "failed", photo: null }));
    };
    const element = rootRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(load, 0);
      return () => { window.clearTimeout(timer); controller.abort(); };
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); load(); }
    }, { rootMargin: "200px" });
    observer.observe(element);
    return () => { observer.disconnect(); controller.abort(); };
  }, [requestKey, restaurantId, shouldLoadGoogle, variant]);

  const googlePhoto = currentRemote.status === "loaded" ? currentRemote.photo : null;
  return (
    <div ref={rootRef} className={`relative overflow-hidden ${className}`}>
      {useLocal && localSrc ? (
        <Image
          src={localSrc}
          alt={alt}
          width={variant === "hero" ? 1600 : variant === "card" ? 720 : 240}
          height={variant === "hero" ? 1000 : variant === "card" ? 540 : 240}
          className="h-full w-full object-cover"
          sizes={variant === "thumbnail" ? "96px" : variant === "card" ? "(max-width: 768px) 100vw, 420px" : "(max-width: 1024px) 100vw, 640px"}
          onError={() => setLocalFailed(true)}
        />
      ) : null}
      {googlePhoto ? (
        <>
          {/* Ephemeral Places URLs intentionally bypass the Next image optimizer/cache. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={googlePhoto.image_url} alt={alt} className="h-full w-full object-cover" loading="lazy" />
          <div className={`absolute right-1 top-1 rounded bg-white/95 shadow-sm ${variant === "thumbnail" ? "px-1.5 py-0.5" : "px-2.5 pb-1.5 pt-2.5"}`}>
            {showSourceLink ? (
              <a href={googlePhoto.google_maps_uri} target="_blank" rel="noreferrer" className="inline-flex whitespace-nowrap text-xs font-normal text-[#5e5e5e] underline" aria-label={`View source photo for ${alt} on Google Maps`}>
                {variant === "thumbnail" ? <span translate="no">Google Maps</span> : <Image src="/google-maps/GoogleMaps_Logo_DarkGray_1x.png" alt="Google Maps" width={98} height={18} />}
              </a>
            ) : (
              <span
                role="link"
                tabIndex={0}
                className="inline-flex whitespace-nowrap text-xs font-normal text-[#5e5e5e] underline"
                aria-label={`View source photo for ${alt || "restaurant"} on Google Maps`}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); window.open(googlePhoto.google_maps_uri, "_blank", "noopener,noreferrer"); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault(); event.stopPropagation(); window.open(googlePhoto.google_maps_uri, "_blank", "noopener,noreferrer");
                  }
                }}
              >{variant === "thumbnail" ? <span translate="no">Google Maps</span> : <Image src="/google-maps/GoogleMaps_Logo_DarkGray_1x.png" alt="Google Maps" width={98} height={18} />}</span>
            )}
          </div>
          {variant === "hero" ? (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-10 text-[11px] text-white">
              {googlePhoto.authors.map((author, index) => (
                <span key={`${author.display_name ?? "author"}-${index}`} className="mr-3 inline-flex items-center gap-1">
                  {author.avatar_uri ? <img src={author.avatar_uri} alt="" className="size-4 rounded-full" referrerPolicy="no-referrer" /> : null /* eslint-disable-line @next/next/no-img-element */}
                  {author.profile_uri ? <a href={author.profile_uri} target="_blank" rel="noreferrer" className="underline">{author.display_name ?? "Photo contributor"}</a> : author.display_name ?? "Photo contributor"}
                </span>
              ))}
              <a href={googlePhoto.google_maps_uri} target="_blank" rel="noreferrer" className="mr-3 underline">Source photo</a>
              {googlePhoto.flag_content_uri ? <a href={googlePhoto.flag_content_uri} target="_blank" rel="noreferrer" className="underline">Report photo</a> : null}
            </div>
          ) : null}
        </>
      ) : null}
      {!useLocal && !googlePhoto ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 via-slate-100 to-amber-50 text-slate-500" aria-hidden="true">
          <span className="absolute -right-3 -top-3 size-12 rounded-full bg-primary/10" />
          <Store className="size-1/3 min-h-4 min-w-4" strokeWidth={1.5} />
        </div>
      ) : null}
    </div>
  );
}
