import Link from "next/link";

import { listRestaurants } from "@/lib/api";
import { RestaurantPhoto } from "@/components/RestaurantPhoto";

export default async function RestaurantsPage() {
  const restaurants = await listRestaurants();

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 sm:px-6">
      <h1 className="font-[family-name:var(--font-fraunces)] text-4xl font-medium tracking-tight">
        Places
      </h1>
      <p className="mt-2 text-muted">Five North End kitchens in the first seed.</p>
      <ul className="mt-6 flex flex-col gap-3">
        {restaurants.map((restaurant) => (
          <li key={restaurant.restaurant_id}>
            <Link
              href={`/restaurants/${restaurant.restaurant_id}`}
              className="flex items-center gap-4 rounded-3xl border border-line bg-card p-4"
            >
              <RestaurantPhoto
                src={restaurant.photo_url}
                alt={restaurant.name}
                className="h-16 w-16 shrink-0 rounded-2xl object-cover"
              />
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-fraunces)] text-2xl font-medium leading-tight">
                  {restaurant.name}
                </p>
                <p className="mt-1 text-sm text-muted">{restaurant.address}</p>
                <p className="mt-3 text-sm capitalize text-basil">
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
