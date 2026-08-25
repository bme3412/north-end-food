"use client";

import { useEffect, useState } from "react";

const NORTH_END_TIME_ZONE = "America/New_York";

function formatNow(): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: NORTH_END_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function LiveClock() {
  // Starts null and fills in after mount, not during SSR -- the server
  // and a client's local clock will never agree to the second, and
  // rendering a real value during SSR would just produce a hydration
  // mismatch warning for a value that's stale the instant it's painted.
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    setTime(formatNow());
    const id = setInterval(() => setTime(formatNow()), 1000);
    return () => clearInterval(id);
  }, []);

  if (time == null) return null;

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full bg-linen-2 px-3 py-1.5 text-xs tabular-nums text-muted sm:flex"
      title="Current time in the North End (America/New_York)"
    >
      <span className="size-1.5 rounded-full bg-basil" aria-hidden="true" />
      {time} ET
    </span>
  );
}
