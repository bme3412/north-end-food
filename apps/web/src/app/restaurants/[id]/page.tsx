import Link from "next/link";

import { getRestaurant, listMenuItems } from "@/lib/api";
import { formatBusynessPercent, formatDate, formatPrice, formatPriceLevel } from "@/lib/format";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import { PriceProfileCard } from "@/components/PriceProfileCard";
import { NotConnectedCard } from "@/components/NotConnectedCard";
import { PopularityChart } from "@/components/PopularityChart";
import { ProvenancePanel } from "@/components/ProvenancePanel";
import { ReviewSummaryCard } from "@/components/ReviewSummaryCard";

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
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <Link href="/" className="text-sm text-basil underline underline-offset-4">
        Back to search
      </Link>

      {/* Hero / identity */}
      <RestaurantPhoto
        src={restaurant.photo_url}
        alt={restaurant.name}
        className="mt-4 h-48 w-full rounded-3xl object-cover sm:h-64"
      />
      <h1 className="mt-4 font-[family-name:var(--font-fraunces)] text-4xl font-medium leading-tight tracking-tight">
        {restaurant.name}
      </h1>
      <p className="mt-2 text-muted">{restaurant.address}</p>
      {restaurant.place_summary ? (
        <p className="mt-2 text-sm leading-relaxed text-ink">
          {restaurant.place_summary}
          <span className="ml-1.5 text-xs text-muted">
            ({restaurant.place_summary_disclosure ?? "Summarized with Gemini"})
          </span>
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-basil-soft px-3 py-1 capitalize text-basil">
          {restaurant.primary_cuisine}
        </span>
        <span className="rounded-full bg-linen-2 px-3 py-1 capitalize">
          {restaurant.establishment_type.replaceAll("_", " ")}
        </span>
        <span className="rounded-full bg-linen-2 px-3 py-1">{menu.total} dishes</span>

        {/* open_now/hours_summary come from our own curated Restaurant.hours
            (app/hours.py), computed live -- independent of whether Google
            Places has ever been connected for this restaurant. Previously
            this whole row was gated on `rating != null`, so a restaurant
            with real hours data but no Places rating (every restaurant,
            currently) showed "not connected" even though hours were known. */}
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

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {restaurant.official_website ? (
          <a
            href={restaurant.official_website}
            className="rounded-full border border-line px-3 py-1"
            target="_blank"
            rel="noreferrer"
          >
            Website
          </a>
        ) : null}
        {restaurant.reservation_url ? (
          <a
            href={restaurant.reservation_url}
            className="rounded-full border border-line px-3 py-1"
            target="_blank"
            rel="noreferrer"
          >
            Reservations
          </a>
        ) : null}
        {restaurant.maps_uri ? (
          <a
            href={restaurant.maps_uri}
            className="rounded-full border border-line px-3 py-1"
            target="_blank"
            rel="noreferrer"
          >
            Google Maps
          </a>
        ) : null}
      </div>

      {lastRefreshed ? <p className="mt-3 text-xs text-muted">Last data refresh: {lastRefreshed}</p> : null}

      {/* Price profile */}
      <div className="mt-8">
        <PriceProfileCard profile={restaurant.price_profile} restaurantName={restaurant.name} />
      </div>

      {/* Full menu */}
      <div className="mt-8 flex flex-col gap-8">
        {[...sections.entries()].map(([section, items]) => (
          <section key={section}>
            <h2 className="font-[family-name:var(--font-fraunces)] text-xl font-medium">{section}</h2>
            <ul className="mt-3 divide-y divide-line rounded-3xl border border-line bg-card">
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

      {/* Google review intelligence */}
      <div className="mt-8">
        <h2 className="font-[family-name:var(--font-fraunces)] text-xl font-medium">Review intelligence</h2>
        <p className="mt-1 text-xs text-muted">
          Google&apos;s AI-generated review summary — a single narrative, not a per-aspect breakdown (Google
          doesn&apos;t expose food/service/value/atmosphere separately here).
        </p>
        <div className="mt-3">
          <ReviewSummaryCard
            summary={restaurant.review_summary}
            disclosure={restaurant.review_summary_disclosure}
            reviewsUri={restaurant.reviews_uri}
          />
        </div>
      </div>

      {/* Popularity / demand */}
      <div className="mt-8">
        <h2 className="font-[family-name:var(--font-fraunces)] text-xl font-medium">Popularity this week</h2>
        {restaurant.weekly_popularity ? (
          <>
            {restaurant.busiest_day || restaurant.quietest_day || restaurant.peak_hours_text ? (
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {restaurant.busiest_day ? (
                  <span className="rounded-full bg-tomato-soft px-3 py-1 text-tomato">
                    Busiest {restaurant.busiest_day}
                  </span>
                ) : null}
                {restaurant.quietest_day ? (
                  <span className="rounded-full bg-basil-soft px-3 py-1 text-basil">
                    Quietest {restaurant.quietest_day}
                  </span>
                ) : null}
                {restaurant.peak_hours_text ? (
                  <span className="rounded-full bg-linen-2 px-3 py-1">Typically busiest {restaurant.peak_hours_text}</span>
                ) : null}
              </div>
            ) : null}
            <p className="mt-2 text-xs text-muted">
              Typical busyness by day of week — a historical pattern from BestTime&apos;s aggregated foot-traffic
              data, not a live reading. The &quot;{formatBusynessPercent(restaurant.busyness_percent)}&quot; badge up
              top is the separate real-time number.
              {weeklyUpdated ? ` Pattern last updated ${weeklyUpdated}.` : ""}
            </p>
          </>
        ) : null}
        <div className="mt-3 rounded-3xl border border-line bg-card p-5">
          {restaurant.weekly_popularity ? (
            <PopularityChart weekly={restaurant.weekly_popularity} />
          ) : restaurant.busyness_percent != null ? (
            <NotConnectedCard
              title={formatBusynessPercent(restaurant.busyness_percent)}
              message="That's the current-hour reading. The full Mon-Sun weekly pattern isn't available for this restaurant yet — see Data sources below for details."
            />
          ) : (
            <NotConnectedCard
              title="Crowd data not available yet"
              message="We don't have foot-traffic data for this restaurant yet. See Data sources below for details."
            />
          )}
        </div>
      </div>

      {/* Data provenance */}
      <div className="mt-8">
        <ProvenancePanel entries={restaurant.provenance} />
      </div>
    </div>
  );
}
