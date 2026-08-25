"use client";

import { useState } from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function hourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 || 12;
  return `${h12} ${period}`;
}

function peakLabel(row: (number | null)[]): string | null {
  const present = row
    .map((value, hour) => ({ hour, value }))
    .filter((entry): entry is { hour: number; value: number } => entry.value != null);
  if (present.length === 0) return null;
  const top = Math.max(...present.map((entry) => entry.value));
  const peakHours = present.filter((entry) => entry.value === top).map((entry) => entry.hour);
  const start = peakHours[0];
  const end = peakHours[peakHours.length - 1];
  return start === end ? hourLabel(start) : `${hourLabel(start)}-${hourLabel(end)}`;
}

export function BusynessChart({ hourly }: { hourly: (number | null)[][] }) {
  const [selectedDay, setSelectedDay] = useState(0);

  const presentHours = new Set<number>();
  for (const day of hourly) {
    day.forEach((value, hour) => {
      if (value != null) presentHours.add(hour);
    });
  }
  const hours = Array.from(presentHours).sort((a, b) => a - b);
  if (hours.length === 0) return null;

  const row = hourly[selectedDay] ?? [];
  const peak = peakLabel(row);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {DAY_LABELS.map((day, index) => (
          <button
            key={day}
            type="button"
            onClick={() => setSelectedDay(index)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedDay === index ? "bg-ink text-linen" : "border border-line text-ink hover:bg-linen-2"
            }`}
          >
            {day}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">{peak ? `Peaks around ${peak}` : "No data for this day yet"}</p>
      <div className="mt-4 flex items-end gap-1.5">
        {hours.map((hour) => {
          const value = row[hour] ?? null;
          const barHeightPct = value == null ? 4 : Math.round(Math.max(0.06, value) * 100);
          return (
            <div key={hour} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-36 w-full items-end">
                <div
                  className="w-full rounded-t-md"
                  style={{
                    height: `${barHeightPct}%`,
                    backgroundColor:
                      value == null ? "var(--linen-2)" : `color-mix(in srgb, var(--basil) ${20 + value * 75}%, var(--card))`,
                  }}
                  title={value == null ? `${hourLabel(hour)}: closed / no data` : `${hourLabel(hour)}: ${Math.round(value * 100)}% busy`}
                />
              </div>
              <span className="text-[0.65rem] text-muted">{hour % 2 === 0 ? hourLabel(hour) : " "}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
