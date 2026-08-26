"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

import { getRestaurant, listMenuItems } from "@/lib/api";
import { asOfTimeToParams, useAsOfTime } from "@/lib/asOfTime";
import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON, FEATURED_CATEGORIES } from "@/lib/categoryIcons";
import { formatPrice, formatPriceLevel, prettyCategory } from "@/lib/format";
import { NORTH_END_CENTER } from "@/lib/geo";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import type { MenuItem, PlaceMatch, RestaurantDetail } from "@/lib/types";

const NORTH_END = { ...NORTH_END_CENTER, zoom: 15.4 };

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
  selectedItems?: MenuItem[];
  onSelect: (place: PlaceMatch | null) => void;
  onOpenItem?: (item: MenuItem) => void;
};

export default function MapView({ places, selectedId, selectedItems = [], onSelect, onOpenItem }: MapViewProps) {
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
        const closed = place.open_now === false;
        const size = active ? 38 : 26 + Math.min(place.match_count, 4) * 2;
        // Color encodes open/closed status (from live-computed hours, see
        // app/hours.py); content is a cuisine icon so a pin says something
        // about the restaurant before you click it. Selection still
        // overrides to tomato so the active pin stays unambiguous. A solid
        // white ring (rather than a pointed pin shape) keeps overlapping
        // markers in dense blocks (Salem/Hanover St) reading as stacked
        // discs instead of merging into an amorphous blob.
        const pinColor = active ? "bg-tomato text-linen" : closed ? "border-2 border-line bg-linen-2 text-muted" : "bg-ink text-linen";
        const icon = active ? DEFAULT_ICON : (place.primary_cuisine && CUISINE_ICONS[place.primary_cuisine]) || DEFAULT_ICON;
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
              className="relative flex flex-col items-center"
              onMouseEnter={() => setHoveredId(place.restaurant_id)}
              onMouseLeave={() => setHoveredId((current) => (current === place.restaurant_id ? null : current))}
            >
              {(hovered && !active) || active ? (
                <span
                  className={`pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-semibold shadow-lg ${
                    active ? "border border-line bg-card text-ink" : "bg-ink text-linen"
                  }`}
                >
                  {place.name}
                </span>
              ) : null}
              <button
                type="button"
                aria-label={`${place.name}, ${place.match_count} match${place.match_count === 1 ? "" : "es"}, ${
                  place.open_now == null ? "hours unknown" : place.open_now ? "open now" : "closed now"
                }`}
                className={`flex items-center justify-center rounded-full shadow-md ring-2 transition-transform ${pinColor} ${
                  active ? "scale-110" : "hover:scale-105"
                } ${hovered && !active ? "ring-tomato" : "ring-linen"}`}
                style={{ width: size, height: size, fontSize: active ? 16 : 12 }}
              >
                <span aria-hidden="true">{icon}</span>
              </button>
            </div>
          </Marker>
        );
      })}
      {selectedId ? (
        (() => {
          const selectedPlace = mappable.find((place) => place.restaurant_id === selectedId);
          if (!selectedPlace) return null;
          return (
            <PlaceDetailCard
              key={selectedPlace.restaurant_id}
              place={selectedPlace}
              items={selectedItems}
              onClose={() => onSelect(null)}
              onOpenItem={onOpenItem}
            />
          );
        })()
      ) : null}
    </Map>
  );
}

function PlaceDetailCard({
  place,
  items,
  onClose,
  onOpenItem,
}: {
  place: PlaceMatch;
  items: MenuItem[];
  onClose: () => void;
  onOpenItem?: (item: MenuItem) => void;
}) {
  const { asOf } = useAsOfTime();
  const [detail, setDetail] = useState<RestaurantDetail | null>(null);
  const [topCategories, setTopCategories] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const atParams = asOfTimeToParams(asOf);
    getRestaurant(place.restaurant_id, atParams)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => undefined);
    // Full menu, not just the currently matched/searched items -- these
    // icons are meant to say "what does this kitchen actually serve", so
    // they shouldn't shrink to nothing just because a search narrowed the
    // sidebar to one or two dishes.
    listMenuItems({ restaurant_id: place.restaurant_id, ...atParams })
      .then((data) => {
        if (cancelled) return;
        const counts: Record<string, number> = {};
        for (const item of data.items) {
          if (!item.canonical_category || !FEATURED_CATEGORIES.includes(item.canonical_category)) continue;
          counts[item.canonical_category] = (counts[item.canonical_category] ?? 0) + 1;
        }
        const ranked = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([category]) => category);
        setTopCategories(ranked.slice(0, 3));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [place.restaurant_id, asOf]);

  const directionsUrl =
    place.latitude != null && place.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`
      : null;

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 md:inset-x-auto md:bottom-6 md:left-6 md:w-[420px] lg:w-[460px]">
      <div className="pointer-events-auto overflow-hidden rounded-3xl border border-line bg-card shadow-xl">
        <div className="relative">
          <RestaurantPhoto src={place.photo_url} alt={place.name} className="h-44 w-full object-cover sm:h-52" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-card/90 text-ink shadow-md backdrop-blur-sm"
          >
            ✕
          </button>
          {place.open_now != null ? (
            <span
              className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-wide shadow-md ${
                place.open_now ? "bg-basil text-linen" : "bg-ink/80 text-linen"
              }`}
            >
              {place.open_now ? (asOf ? "Open" : "Open now") : "Closed"}
            </span>
          ) : null}
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/restaurants/${place.restaurant_id}`}
              className="font-[family-name:var(--font-fraunces)] text-xl font-medium leading-tight hover:underline"
            >
              {place.name}
            </Link>
            {directionsUrl ? (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-linen"
              >
                Directions →
              </a>
            ) : null}
          </div>

          <p className="mt-1 text-sm text-muted">{place.address}</p>

          <p className="mt-2 text-sm text-muted">
            {detail?.rating != null ? (
              <>
                ★ {detail.rating}
                {detail.review_count != null ? ` (${detail.review_count})` : ""} ·{" "}
              </>
            ) : null}
            {place.primary_cuisine ? <span className="capitalize">{prettyCategory(place.primary_cuisine)}</span> : null}
            {detail?.price_level != null ? ` · ${formatPriceLevel(detail.price_level)}` : ""}
          </p>

          {place.hours_summary ? <p className="mt-1 text-xs text-muted">{place.hours_summary}</p> : null}

          {detail?.place_summary ? (
            <p className="mt-3 text-sm leading-relaxed text-ink">{detail.place_summary}</p>
          ) : null}

          {topCategories.length || (detail && detail.reservation_url == null) || place.takeout ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {topCategories.map((category) => (
                <span
                  key={category}
                  className="flex items-center gap-1 rounded-full bg-linen-2 px-2.5 py-1 capitalize text-ink"
                >
                  <span aria-hidden="true">{CATEGORY_ICONS[category] ?? DEFAULT_CATEGORY_ICON}</span>
                  {prettyCategory(category)}
                </span>
              ))}
              {place.takeout ? (
                <span className="rounded-full bg-basil-soft px-2.5 py-1 text-basil">🥡 Takeout available</span>
              ) : null}
              {detail && detail.reservation_url == null ? (
                <span className="rounded-full bg-linen-2 px-2.5 py-1 text-muted">ⓘ No reservations</span>
              ) : null}
            </div>
          ) : null}

          {items.length ? (
            <div className="mt-5 border-t border-line pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Matched dishes here</p>
                <Link
                  href={`/restaurants/${place.restaurant_id}`}
                  className="shrink-0 text-xs font-medium uppercase tracking-wide text-basil"
                >
                  View full menu
                </Link>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {items.slice(0, 2).map((item) => (
                  <button
                    key={item.menu_item_id}
                    type="button"
                    onClick={() => onOpenItem?.(item)}
                    className="rounded-2xl bg-linen px-3 py-2.5 text-left"
                  >
                    <p className="truncate text-sm text-ink">{item.raw_name}</p>
                    <p className="mt-1 font-bold text-tomato">{formatPrice(item)}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
