"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AsOfTime = {
  day: number; // 0=Mon..6=Sun, matches the API's `at_day` and Restaurant.hours[*].days
  time: string; // "HH:MM", 24h
  until: string | null; // "HH:MM", 24h -- set for a range check instead of a single moment
} | null;

type AsOfTimeContextValue = {
  asOf: AsOfTime;
  setAsOf: (next: AsOfTime) => void;
  isLive: boolean;
  // Whether the "Open now" checkbox (header, next to the clock) is
  // filtering results at all -- on by default, independent of whether a
  // specific preview day/time is also set.
  openNowEnabled: boolean;
  setOpenNowEnabled: (next: boolean) => void;
};

const AsOfTimeContext = createContext<AsOfTimeContextValue | null>(null);

export function AsOfTimeProvider({ children }: { children: ReactNode }) {
  const [asOf, setAsOf] = useState<AsOfTime>(null);
  const [openNowEnabled, setOpenNowEnabled] = useState(true);
  const value = useMemo<AsOfTimeContextValue>(
    () => ({ asOf, setAsOf, isLive: asOf === null, openNowEnabled, setOpenNowEnabled }),
    [asOf, openNowEnabled],
  );
  return <AsOfTimeContext.Provider value={value}>{children}</AsOfTimeContext.Provider>;
}

// Every screen that shows "open now" (dish list, map pins, the place card)
// reads this same context, so setting a preview time in the header
// coordinates all of them at once instead of each having its own idea of
// "now".
export function useAsOfTime(): AsOfTimeContextValue {
  const ctx = useContext(AsOfTimeContext);
  if (!ctx) throw new Error("useAsOfTime must be used within AsOfTimeProvider");
  return ctx;
}

export function asOfTimeToParams(asOf: AsOfTime): Record<string, string | undefined> {
  if (!asOf) return {};
  return {
    at_day: String(asOf.day),
    at_time: asOf.time,
    at_until: asOf.until ?? undefined,
  };
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_OPTIONS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
];

function formatClock(value: string): string {
  const [hourStr, minute] = value.split(":");
  const hour = Number(hourStr);
  const period = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 || 12;
  return minute === "00" ? `${hour12} ${period}` : `${hour12}:${minute} ${period}`;
}

export function formatAsOfLabel(asOf: AsOfTime): string {
  if (!asOf) return "Now";
  const start = formatClock(asOf.time);
  if (asOf.until) return `${DAY_LABELS[asOf.day]} ${start}–${formatClock(asOf.until)}`;
  return `${DAY_LABELS[asOf.day]} ${start}`;
}

/** The current day/time in the North End (America/New_York), as a
 * `{day, time}` pair matching `AsOfTime`'s shape -- used to seed the time
 * picker with "right now" instead of a fixed default. */
export function nowAsOfTime(): { day: number; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "12";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const dayIndex = DAY_LABELS.indexOf(weekday);
  return { day: dayIndex === -1 ? 0 : dayIndex, time: `${hour.padStart(2, "0")}:${minute}` };
}
