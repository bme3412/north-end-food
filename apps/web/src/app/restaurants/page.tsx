import Link from "next/link";

import { listRestaurants } from "@/lib/api";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";

export default async function RestaurantsPage() {
  const restaurants = await listRestaurants();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">
        Places
      </h1>
      <p className="mt-1 text-sm text-muted">{restaurants.length} North End kitchens in the seed.</p>
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {restaurants.map((restaurant) => (
          <li key={restaurant.restaurant_id}>
            <Link
              href={`/restaurants/${restaurant.restaurant_id}`}
              className="flex items-center gap-3 rounded-xl border border-line bg-card p-3 shadow-[0_1px_4px_rgba(23,27,32,0.05)] transition-colors hover:border-primary/30 hover:bg-primary-soft/20"
            >
              <RestaurantPhoto
                src={restaurant.photo_url}
                alt={restaurant.name}
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight">
                  {restaurant.name}
                </p>
                <p className="mt-1 text-xs text-muted">{restaurant.address}</p>
                <p className="mt-2 text-[10px] capitalize text-basil">
                  {restaurant.establishment_type.replaceAll("_", " ")}
                  <span className="text-muted"> · {restaurant.primary_cuisine}</span>
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
