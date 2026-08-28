"use client";

import { Bookmark, Heart } from "lucide-react";

import { useSaved, type SavedDish, type SavedRestaurant } from "@/lib/saved";

type Props =
  | { kind: "dish"; item: SavedDish; compact?: boolean }
  | { kind: "restaurant"; item: SavedRestaurant; compact?: boolean };

export function SaveButton(props: Props) {
  const { isDishSaved, isRestaurantSaved, toggleDish, toggleRestaurant } = useSaved();
  const saved =
    props.kind === "dish" ? isDishSaved(props.item.menu_item_id) : isRestaurantSaved(props.item.restaurant_id);
  const Icon = props.kind === "dish" ? Heart : Bookmark;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (props.kind === "dish") toggleDish(props.item);
        else toggleRestaurant(props.item);
      }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${props.kind} from saved` : `Save ${props.kind}`}
      className={`inline-flex items-center justify-center rounded-full transition-colors ${
        props.compact ? "size-8" : "min-h-11 gap-2 px-4"
      } ${saved ? "bg-primary-soft text-primary" : "bg-card/90 text-ink shadow-sm hover:bg-linen-2"}`}
    >
      <Icon className="size-4" fill={saved ? "currentColor" : "none"} aria-hidden="true" />
      {!props.compact ? <span className="text-xs font-semibold">{saved ? "Saved" : "Save"}</span> : null}
    </button>
  );
}
