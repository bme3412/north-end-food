"use client";

import { useEffect, useState } from "react";

const NORTH_END_TIME_ZONE = "America/New_York";

function formatNow(): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: NORTH_END_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LiveClock() {
  // Starts null and fills in after mount, not during SSR -- the server
  // and a client's local clock will never agree, and rendering a real
  // value during SSR would just produce a hydration mismatch warning for
  // a value that's stale the instant it's painted.
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const initialId = window.setTimeout(() => setTime(formatNow()), 0);
    // Minute-resolution display only needs a minute-resolution timer.
    const id = window.setInterval(() => setTime(formatNow()), 30_000);
    return () => {
      window.clearTimeout(initialId);
      window.clearInterval(id);
    };
  }, []);

  if (time == null) return null;

  return (
    <span
      className="shrink-0 text-[11px] font-medium tabular-nums text-ink"
      title="Current time in the North End (America/New_York)"
    >
      {time}
    </span>
  );
}
