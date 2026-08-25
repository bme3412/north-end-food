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
    setTime(formatNow());
    // Minute-resolution display only needs a minute-resolution timer.
    const id = setInterval(() => setTime(formatNow()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (time == null) return null;

  return (
    <span
      className="hidden shrink-0 text-sm tabular-nums text-muted sm:inline"
      title="Current time in the North End (America/New_York)"
    >
      {time} ET
    </span>
  );
}
