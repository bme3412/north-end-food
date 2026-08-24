import Link from "next/link";

import { getRestaurant, listMenuItems } from "@/lib/api";
import { formatDate, formatPrice, formatPriceLevel, formatWaitMinutes } from "@/lib/format";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";
import { PriceProfileCard } from "@/components/PriceProfileCard";
import { NotConnectedCard } from "@/components/NotConnectedCard";
import { PopularityChart } from "@/components/PopularityChart";
import { ProvenancePanel } from "@/components/ProvenancePanel";

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

  const hasLiveDetails = restaurant.rating != null;
  const lastRefreshed = formatDate(restaurant.last_verified_at);

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

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-basil-soft px-3 py-1 capitalize text-basil">
          {restaurant.primary_cuisine}
        </span>
        <span className="rounded-full bg-linen-2 px-3 py-1 capitalize">
          {restaurant.establishment_type.replaceAll("_", " ")}
        </span>
        <span className="rounded-full bg-linen-2 px-3 py-1">{menu.total} dishes</span>

        {hasLiveDetails ? (
          <>
            <span className="rounded-full bg-linen-2 px-3 py-1">
              ★ {restaurant.rating} ({restaurant.review_count ?? 0})
            </span>
            {restaurant.price_level != null ? (
              <span className="rounded-full bg-linen-2 px-3 py-1">{formatPriceLevel(restaurant.price_level)}</span>
            ) : null}
            {restaurant.open_now != null ? (
              <span
                className={`rounded-full px-3 py-1 ${
                  restaurant.open_now ? "bg-basil-soft text-basil" : "bg-tomato-soft text-tomato"
                }`}
              >
                {restaurant.open_now ? "Open now" : "Closed now"}
              </span>
            ) : null}
            {restaurant.wait_minutes != null ? (
              <span className="rounded-full bg-linen-2 px-3 py-1">{formatWaitMinutes(restaurant.wait_minutes)}</span>
            ) : null}
          </>
        ) : (
          <span className="rounded-full bg-linen-2 px-3 py-1 text-muted">
            Rating &amp; hours not connected — see data sources below
          </span>
        )}
      </div>

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
        <div className="mt-3">
          <NotConnectedCard
            title="Not built yet"
            message="Summarizing reviews by food / service / value / atmosphere / wait needs real Google review text (Places API) plus a Gemini summarization pass — a bigger build than a single API key. Deferred for now rather than shipped with invented sentiment."
          />
        </div>
      </div>

      {/* Popularity / demand */}
      <div className="mt-8">
        <h2 className="font-[family-name:var(--font-fraunces)] text-xl font-medium">Popularity this week</h2>
        <div className="mt-3 rounded-3xl border border-line bg-card p-5">
          {restaurant.weekly_popularity ? (
            <PopularityChart weekly={restaurant.weekly_popularity} />
          ) : (
            <NotConnectedCard
              title="Crowd data needs an API key"
              message="Add BESTTIME_API_KEY to apps/api's .env and run scripts/refresh_busyness.py to populate the weekly pattern."
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
