import { formatDollars, formatPctVsMedian, prettyCategory } from "@/lib/format";
import type { PriceProfile } from "@/lib/types";

export function PriceProfileCard({
  profile,
  restaurantName,
}: {
  profile: PriceProfile;
  restaurantName: string;
}) {
  const pctLabel = formatPctVsMedian(profile.pct_vs_median);
  const hasData = profile.restaurant_median != null;

  return (
    <section className="rounded-3xl border border-line bg-card p-5">
      <h2 className="font-[family-name:var(--font-fraunces)] text-xl font-medium">Price profile</h2>
      {hasData ? (
        <>
          <div className="mt-4 flex flex-col gap-4">
            <MetricPair
              restaurantLabel="Median menu item"
              neLabel="Median North End"
              restaurantValue={profile.restaurant_median}
              neValue={profile.north_end_median}
            />
            {profile.categories.map((category) => (
              <MetricPair
                key={category.category}
                restaurantLabel={`${prettyCategory(category.category)} median`}
                neLabel={`North End ${prettyCategory(category.category)}`}
                restaurantValue={category.restaurant_median}
                neValue={category.north_end_median}
              />
            ))}
          </div>
          {pctLabel ? (
            <p className="mt-4 text-sm font-medium text-basil">
              {restaurantName} is {pctLabel}.
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">No priced items yet for this restaurant.</p>
      )}
    </section>
  );
}

function MetricPair({
  restaurantLabel,
  neLabel,
  restaurantValue,
  neValue,
}: {
  restaurantLabel: string;
  neLabel: string;
  restaurantValue: string | null;
  neValue: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-line pb-3 text-sm capitalize last:border-none last:pb-0">
      <div className="flex items-center justify-between">
        <span>{restaurantLabel}</span>
        <span className="font-bold text-tomato">
          {restaurantValue != null ? formatDollars(restaurantValue) : "—"}
        </span>
      </div>
      <div className="flex items-center justify-between text-muted">
        <span>{neLabel}</span>
        <span>{neValue != null ? formatDollars(neValue) : "—"}</span>
      </div>
    </div>
  );
}
