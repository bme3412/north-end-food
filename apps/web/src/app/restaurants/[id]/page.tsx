import Link from "next/link";

import { getRestaurant, listMenuItems } from "@/lib/api";
import { formatBusynessPercent, formatDate, formatPrice, formatPriceLevel } from "@/lib/format";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import { PriceProfileCard } from "@/components/PriceProfileCard";
import { NotConnectedCard } from "@/components/NotConnectedCard";
import { BusynessChart } from "@/components/BusynessChart";
import { ProvenancePanel } from "@/components/ProvenancePanel";
import { ReviewSummaryCard } from "@/components/ReviewSummaryCard";
import { SaveButton } from "@/components/SaveButton";
import { GoogleMapsAttribution } from "@/components/GoogleMapsAttribution";
const ABOUT_SUMMARIES = "https://support.google.com/local-listings/answer/9851099";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function RestaurantPage({ params }: PageProps) {
  const { id } = await params;
  const restaurant = await getRestaurant(id);
  const menu = await listMenuItems({ restaurant_id: id });

  const sections = new Map<string, typeof menu.items>();
  for (const item of menu.items) {
    const key = item.menu_section || "Menu";
    const list = sections.get(key) ?? [];
    list.push(item);
    sections.set(key, list);
  }

  const hasRating = restaurant.rating != null;
  const lastRefreshed = formatDate(restaurant.last_verified_at);
  const weeklyUpdated = formatDate(restaurant.weekly_popularity_updated_at);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-3 sm:px-6 sm:pt-5">
      <Link href="/search" className="inline-flex min-h-11 items-center text-xs font-medium text-primary hover:underline">
        Back to search
      </Link>

      <div className="relative -mx-4 overflow-hidden sm:hidden">
        <RestaurantPhoto
          restaurantId={restaurant.restaurant_id}
          localSrc={restaurant.photo_url}
          alt={restaurant.name}
          variant="hero"
          className="aspect-[16/10] w-full object-cover"
        />
        <div className="absolute right-4 top-4">
          <SaveButton kind="restaurant" item={restaurant} />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink/55 to-transparent" aria-hidden="true" />
        {restaurant.open_now != null ? (
          <span className={`absolute bottom-4 left-4 rounded-full px-3 py-1 text-xs font-bold text-white ${restaurant.open_now ? "bg-basil" : "bg-ink/80"}`}>
            {restaurant.open_now ? "Open now" : "Closed now"}
          </span>
        ) : null}
      </div>

      {/* Identity header */}
      <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight sm:mt-3">
        {restaurant.name}
      </h1>
      <p className="mt-2 text-muted">{restaurant.address}</p>
      {restaurant.place_summary && restaurant.place_summary_disclosure && restaurant.place_summary_flag_uri ? (
        <div className="mt-2 text-sm leading-relaxed text-ink">
          <p>{restaurant.place_summary}</p>
          <p className="mt-1 text-xs text-muted">{restaurant.place_summary_disclosure}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs">
            <a href={ABOUT_SUMMARIES} target="_blank" rel="noreferrer" className="text-basil underline">About this summary</a>
            <a href={restaurant.place_summary_flag_uri} target="_blank" rel="noreferrer" className="text-basil underline">Report summary</a>
            <GoogleMapsAttribution href={restaurant.maps_uri} />
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-basil-soft px-3 py-1 capitalize text-basil">
          {restaurant.primary_cuisine}
        </span>
        <span className="rounded-full bg-linen-2 px-3 py-1 capitalize">
          {restaurant.establishment_type.replaceAll("_", " ")}
        </span>
        <span className="rounded-full bg-linen-2 px-3 py-1">{menu.total} dishes</span>

        {restaurant.open_now != null ? (
          <span
            className={`rounded-full px-3 py-1 ${
              restaurant.open_now ? "bg-basil-soft text-basil" : "bg-tomato-soft text-tomato"
            }`}
          >
            {restaurant.open_now ? "Open now" : "Closed now"}
          </span>
        ) : null}

        {hasRating ? (
          <>
            <span className="rounded-full bg-linen-2 px-3 py-1">
              ★ {restaurant.rating} ({restaurant.review_count ?? 0})
            </span>
            {restaurant.price_level != null ? (
              <span className="rounded-full bg-linen-2 px-3 py-1">{formatPriceLevel(restaurant.price_level)}</span>
            ) : null}
            <GoogleMapsAttribution href={restaurant.maps_uri} />
            {restaurant.busyness_percent != null ? (
              <span className="rounded-full bg-linen-2 px-3 py-1">{formatBusynessPercent(restaurant.busyness_percent)}</span>
            ) : null}
          </>
        ) : null}

        {restaurant.open_now == null && !hasRating ? (
          <span className="rounded-full bg-linen-2 px-3 py-1 text-muted">
            Rating not connected — see data sources below
          </span>
        ) : null}
      </div>
      {restaurant.hours_summary ? <p className="mt-2 text-sm text-muted">{restaurant.hours_summary}</p> : null}

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap">
        {restaurant.official_website ? (
          <a
            href={restaurant.official_website}
            className="flex min-h-11 items-center justify-center rounded-xl border border-line px-4 font-semibold"
            target="_blank"
            rel="noreferrer"
          >
            Website
          </a>
        ) : null}
        {restaurant.reservation_url ? (
          <a
            href={restaurant.reservation_url}
            className="flex min-h-11 items-center justify-center rounded-xl border border-line px-4 font-semibold"
            target="_blank"
            rel="noreferrer"
          >
            Reservations
          </a>
        ) : null}
        {restaurant.maps_uri ? (
          <a
            href={restaurant.maps_uri}
            className="flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 font-semibold text-white"
            target="_blank"
            rel="noreferrer"
          >
            Google Maps
          </a>
        ) : null}
      </div>

      {lastRefreshed ? <p className="mt-3 text-xs text-muted">Last data refresh: {lastRefreshed}</p> : null}

      {/* Photo (left) + review/popularity/price stats (right) side by side,
          rather than stacked full-width, so the page reads in one screenful
          instead of a long scroll of sequential sections. */}
      <div className="mt-6 grid gap-8 lg:grid-cols-[320px_1fr]">
        <div className="hidden sm:block lg:sticky lg:top-20 lg:self-start">
          <RestaurantPhoto
            restaurantId={restaurant.restaurant_id}
            localSrc={restaurant.photo_url}
            alt={restaurant.name}
            variant="hero"
            className="aspect-[3/4] w-full max-w-xs rounded-xl bg-linen-2 object-cover shadow-[0_1px_4px_rgba(23,27,32,0.06)] lg:max-w-none"
          />
          <div className="mt-3">
            <SaveButton kind="restaurant" item={restaurant} />
          </div>
        </div>

        <div className="flex flex-col gap-8">
          {/* Google review intelligence */}
          <div>
            <h2 className="text-base font-bold">Review summary</h2>
            <div className="mt-3">
              <ReviewSummaryCard
                summary={restaurant.review_summary}
                disclosure={restaurant.review_summary_disclosure}
                flagUri={restaurant.review_summary_flag_uri}
                reviewsUri={restaurant.reviews_uri}
              />
            </div>
          </div>

          {/* Popularity / demand */}
          <div>
            <h2 className="text-base font-bold">Popularity this week</h2>
            {restaurant.peak_hours_text ? (
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-linen-2 px-3 py-1">Typically busiest {restaurant.peak_hours_text}</span>
              </div>
            ) : null}
            {restaurant.hourly_popularity ? (
              <p className="mt-2 text-xs text-muted">
                Hour-by-hour, historical pattern from Google&apos;s Popular Times data, not a live reading.
                {weeklyUpdated ? ` Last updated ${weeklyUpdated}.` : ""}
              </p>
            ) : null}
            <div className="mt-3 rounded-xl border border-line bg-card p-5 shadow-[0_1px_4px_rgba(23,27,32,0.05)]">
              {restaurant.hourly_popularity ? (
                <BusynessChart hourly={restaurant.hourly_popularity} />
              ) : restaurant.weekly_popularity ? (
                <NotConnectedCard
                  title="Hour-by-hour not available yet"
                  message="We have this restaurant's daily pattern but not the hourly breakdown yet — see Data sources below for details."
                />
              ) : restaurant.busyness_percent != null ? (
                <NotConnectedCard
                  title={formatBusynessPercent(restaurant.busyness_percent)}
                  message="That's the current-hour reading. The full weekly pattern isn't available for this restaurant yet — see Data sources below for details."
                />
              ) : (
                <NotConnectedCard
                  title="Crowd data not available yet"
                  message="We don't have foot-traffic data for this restaurant yet. See Data sources below for details."
                />
              )}
            </div>
          </div>

          {/* Price profile */}
          <PriceProfileCard profile={restaurant.price_profile} restaurantName={restaurant.name} />
        </div>
      </div>

      {/* Full menu */}
      <div className="mt-8 flex flex-col gap-8">
        {[...sections.entries()].map(([section, items]) => (
          <section key={section}>
            <h2 className="text-base font-bold">{section}</h2>
            <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-card shadow-[0_1px_4px_rgba(23,27,32,0.04)]">
              {items.map((item) => (
                <li key={item.menu_item_id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-bold leading-snug">{item.raw_name}</p>
                    {item.raw_description ? (
                      <p className="mt-1 text-sm leading-snug text-muted">{item.raw_description}</p>
                    ) : null}
                  </div>
                  <p className="shrink-0 font-bold text-tomato">{formatPrice(item)}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Data provenance */}
      <div className="mt-8">
        <ProvenancePanel entries={restaurant.provenance} />
      </div>
    </div>
  );
}
