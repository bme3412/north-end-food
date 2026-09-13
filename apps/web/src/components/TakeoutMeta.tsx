import { formatAppBand, formatMoney, takeoutQuote } from "@/lib/takeoutPrice";
import {
  orderPath,
  pickupNowLabel,
  restaurantTakeoutFlags,
  takeoutFlagLabels,
  takeoutSuitability,
  takeoutSuitabilityLabel,
} from "@/lib/takeoutTraits";
import type { ServiceMode } from "@/lib/serviceMode";
import type { MenuItem } from "@/lib/types";

export function TakeoutPriceBlock({
  item,
  mode,
  align = "right",
}: {
  item: MenuItem;
  mode: ServiceMode;
  align?: "left" | "right";
}) {
  const quote = takeoutQuote(item.price);
  if (!quote) {
    return <span className={align === "right" ? "text-right" : ""}>Ask</span>;
  }
  if (mode === "delivery") {
    return (
      <span className={`block ${align === "right" ? "text-right" : ""}`}>
        <span className="font-semibold tabular-nums">{formatAppBand(quote)}</span>
        <span className="mt-0.5 block text-[10px] font-normal text-muted">typical app total</span>
      </span>
    );
  }
  return (
    <span className={`block ${align === "right" ? "text-right" : ""}`}>
      <span className="font-semibold tabular-nums">{formatMoney(quote.pickup)}</span>
      <span className="mt-0.5 block text-[10px] font-normal text-muted">pickup with tax</span>
    </span>
  );
}

export function TakeoutSecondaryPrice({ item, mode }: { item: MenuItem; mode: ServiceMode }) {
  const quote = takeoutQuote(item.price);
  if (!quote) return null;
  if (mode === "delivery") {
    return (
      <p className="text-[11px] text-muted">
        Menu {formatMoney(quote.menu)} · pickup {formatMoney(quote.pickup)}
      </p>
    );
  }
  return (
    <p className="text-[11px] text-muted">
      Menu {formatMoney(quote.menu)} · on an app, typically {formatAppBand(quote)}
    </p>
  );
}

export function TakeoutBadges({ item, compact = false }: { item: MenuItem; compact?: boolean }) {
  const flags = takeoutFlagLabels(restaurantTakeoutFlags(item.restaurant_id));
  const travel = takeoutSuitabilityLabel(takeoutSuitability(item));
  const pickup = pickupNowLabel(item);
  const order = orderPath(item);
  const badges = [
    pickup,
    travel,
    ...flags,
    item.delivery === false ? "No delivery listed" : null,
  ].filter((label): label is string => Boolean(label));

  if (!badges.length && !order.href) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "mt-1" : "mt-1.5"}`}>
      {badges.map((label) => (
        <span
          key={label}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            label === "Better eaten here" || label === "Often sells out" || label === "No delivery listed"
              ? "bg-tomato-soft text-tomato"
              : label.startsWith("Open for pickup")
                ? "bg-basil-soft text-basil"
                : "bg-linen-2 text-ink"
          }`}
        >
          {label}
        </span>
      ))}
      {order.href ? (
        <a
          href={order.href}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-white"
        >
          {order.label}
        </a>
      ) : (
        <span className="text-[10px] text-muted">{order.label}</span>
      )}
    </div>
  );
}
