"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

import { formatPrice } from "@/lib/format";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import type { PlaceMatch } from "@/lib/types";

const NORTH_END = { latitude: 42.3642, longitude: -71.054, zoom: 15.4 };

const CUISINE_ICONS: Record<string, string> = {
  italian: "🍝",
  pizza: "🍕",
  seafood: "🦞",
  bakery: "🥐",
  cafe: "☕",
};
const DEFAULT_ICON = "🍽️";

type MapViewProps = {
  places: PlaceMatch[];
  selectedId: string | null;
  onSelect: (place: PlaceMatch | null) => void;
};

export default function MapView({ places, selectedId, onSelect }: MapViewProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const mappable = useMemo(
    () => places.filter((place) => place.latitude != null && place.longitude != null),
    [places],
  );

  if (!token) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center bg-linen-2 p-6 text-center">
        <div className="max-w-sm">
          <p className="font-[family-name:var(--font-fraunces)] text-xl font-medium">Map needs a token</p>
          <p className="mt-2 text-sm text-muted">
            Add <code className="rounded bg-card px-1">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to{" "}
            <code className="rounded bg-card px-1">apps/web/.env.local</code> and restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Map
      mapboxAccessToken={token}
      initialViewState={NORTH_END}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      style={{ width: "100%", height: "100%" }}
      attributionControl={false}
      onClick={() => onSelect(null)}
    >
      <NavigationControl position="top-right" showCompass={false} />
      {mappable.map((place) => {
        const active = place.restaurant_id === selectedId;
        const size = active ? 44 : 32 + Math.min(place.match_count, 4) * 4;
        // Color encodes open/closed status (from live-computed hours, see
        // app/hours.py); content is a cuisine icon so a pin says something
        // about the restaurant before you click it. Selection still
        // overrides to tomato so the active pin stays unambiguous.
        const statusColor = active
          ? "border-ink bg-tomato"
          : place.open_now === false
            ? "border-line bg-card opacity-70"
            : "border-card bg-basil";
        const icon = (place.primary_cuisine && CUISINE_ICONS[place.primary_cuisine]) || DEFAULT_ICON;
        const hovered = hoveredId === place.restaurant_id;
        return (
          <Marker
            key={place.restaurant_id}
            latitude={place.latitude!}
            longitude={place.longitude!}
            anchor="center"
            // Overlapping markers in dense blocks (Salem/Hanover St) meant
            // whichever pin happened to render later in the list sat on
            // top regardless of hover/selection -- a hovered pin's own
            // tooltip could end up visually buried under a sibling that
            // just happened to be later in `mappable`. Forcing z-index by
            // interaction state (hovered > selected > rest) keeps the
            // pin you're actually pointing at, and its label, on top.
            style={{ zIndex: hovered ? 1000 : active ? 500 : undefined }}
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              onSelect(active ? null : place);
            }}
          >
            <div
              className="relative flex items-center justify-center"
              onMouseEnter={() => setHoveredId(place.restaurant_id)}
              onMouseLeave={() => setHoveredId((current) => (current === place.restaurant_id ? null : current))}
            >
              {hovered ? (
                <span className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-sm font-semibold text-linen shadow-lg">
                  {place.name}
                </span>
              ) : null}
              <button
                type="button"
                aria-label={`${place.name}, ${place.match_count} match${place.match_count === 1 ? "" : "es"}, ${
                  place.open_now == null ? "hours unknown" : place.open_now ? "open now" : "closed now"
                }`}
                className={`flex items-center justify-center rounded-full border-2 shadow-md transition-transform ${statusColor} ${
                  active ? "scale-110" : "hover:scale-105"
                } ${hovered ? "ring-4 ring-blue-500" : ""}`}
                style={{ width: size, height: size, fontSize: active ? 20 : 16 }}
              >
                <span aria-hidden="true">{icon}</span>
              </button>
            </div>
          </Marker>
        );
      })}
      {selectedId ? (
        <SelectedPlaceCard
          place={mappable.find((place) => place.restaurant_id === selectedId) ?? null}
          onClose={() => onSelect(null)}
        />
      ) : null}
    </Map>
  );
}

function SelectedPlaceCard({
  place,
  onClose,
}: {
  place: PlaceMatch | null;
  onClose: () => void;
}) {
  if (!place) return null;
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 md:inset-x-auto md:bottom-6 md:left-6 md:w-72">
      <div className="pointer-events-auto rounded-2xl border border-line bg-card/95 p-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <RestaurantPhoto
              src={place.photo_url}
              alt={place.name}
              className="h-12 w-12 shrink-0 rounded-xl object-cover"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Link
                  href={`/restaurants/${place.restaurant_id}`}
                  className="font-[family-name:var(--font-fraunces)] text-lg font-medium leading-tight hover:underline"
                >
                  {place.name}
                </Link>
                {place.open_now != null ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${
                      place.open_now ? "bg-basil-soft text-basil" : "bg-muted/15 text-muted"
                    }`}
                  >
                    {place.open_now ? "Open now" : "Closed"}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted">{place.address}</p>
              {place.hours_summary ? <p className="mt-0.5 text-xs text-muted">{place.hours_summary}</p> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-sm text-muted hover:bg-linen">
            ✕
          </button>
        </div>
        {place.lowest_price != null ? (
          <p className="mt-3 text-sm">
            <span className="font-bold text-tomato">
              {formatPrice({ price: place.lowest_price, market_price: false })}
            </span>
            <span className="text-muted"> and up</span>
          </p>
        ) : null}
        {place.sample_name ? (
          <p className="mt-1 text-sm text-muted line-clamp-2">
            <span className="text-ink">Try: </span>
            {place.sample_name}
          </p>
        ) : null}
      </div>
    </div>
  );
}
