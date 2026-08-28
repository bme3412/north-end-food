"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { MenuItem, RestaurantSummary } from "@/lib/types";

const STORAGE_KEY = "north-end-food:saved:v1";

export type SavedDish = Pick<
  MenuItem,
  | "menu_item_id"
  | "restaurant_id"
  | "restaurant_name"
  | "raw_name"
  | "raw_description"
  | "price"
  | "raw_price_text"
  | "market_price"
  | "canonical_category"
  | "pct_vs_median"
>;

export type SavedRestaurant = Pick<
  RestaurantSummary,
  "restaurant_id" | "name" | "address" | "primary_cuisine" | "photo_url" | "open_now"
>;

export type SavedState = {
  dishes: SavedDish[];
  restaurants: SavedRestaurant[];
};

export const EMPTY_SAVED: SavedState = { dishes: [], restaurants: [] };

export function parseSavedState(value: string | null): SavedState {
  if (!value) return EMPTY_SAVED;
  try {
    const parsed = JSON.parse(value) as Partial<SavedState>;
    return {
      dishes: Array.isArray(parsed.dishes) ? parsed.dishes : [],
      restaurants: Array.isArray(parsed.restaurants) ? parsed.restaurants : [],
    };
  } catch {
    return EMPTY_SAVED;
  }
}

type SavedContextValue = {
  saved: SavedState;
  ready: boolean;
  toggleDish: (dish: SavedDish) => void;
  toggleRestaurant: (restaurant: SavedRestaurant) => void;
  isDishSaved: (id: string) => boolean;
  isRestaurantSaved: (id: string) => boolean;
};

const SavedContext = createContext<SavedContextValue | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<SavedState>(EMPTY_SAVED);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSaved(parseSavedState(window.localStorage.getItem(STORAGE_KEY)));
      setReady(true);
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [ready, saved]);

  const value = useMemo<SavedContextValue>(
    () => ({
      saved,
      ready,
      toggleDish: (dish) =>
        setSaved((current) => ({
          ...current,
          dishes: current.dishes.some((item) => item.menu_item_id === dish.menu_item_id)
            ? current.dishes.filter((item) => item.menu_item_id !== dish.menu_item_id)
            : [dish, ...current.dishes],
        })),
      toggleRestaurant: (restaurant) =>
        setSaved((current) => ({
          ...current,
          restaurants: current.restaurants.some((item) => item.restaurant_id === restaurant.restaurant_id)
            ? current.restaurants.filter((item) => item.restaurant_id !== restaurant.restaurant_id)
            : [restaurant, ...current.restaurants],
        })),
      isDishSaved: (id) => saved.dishes.some((item) => item.menu_item_id === id),
      isRestaurantSaved: (id) => saved.restaurants.some((item) => item.restaurant_id === id),
    }),
    [ready, saved],
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const value = useContext(SavedContext);
  if (!value) throw new Error("useSaved must be used within SavedProvider");
  return value;
}
