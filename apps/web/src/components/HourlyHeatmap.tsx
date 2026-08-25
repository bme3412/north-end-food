import { Fragment } from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Warm amber sitting between the app's basil (green) and tomato (red)
// tokens, so the low/high ends of this diverging scale reuse the existing
// palette instead of introducing a whole separate color system.
const AMBER = "#d9a441";

function hourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${period}`;
}

function heatColor(value: number): string {
  if (value <= 0.5) {
    const t = Math.round((value / 0.5) * 100);
    return `color-mix(in srgb, ${AMBER} ${t}%, var(--basil))`;
  }
  const t = Math.round(((value - 0.5) / 0.5) * 100);
  return `color-mix(in srgb, var(--tomato) ${t}%, ${AMBER})`;
}

export function HourlyHeatmap({ hourly }: { hourly: (number | null)[][] }) {
  const presentHours = new Set<number>();
  for (const day of hourly) {
    day.forEach((value, hour) => {
      if (value != null) presentHours.add(hour);
    });
  }
  const hours = Array.from(presentHours).sort((a, b) => a - b);
  if (hours.length === 0) return null;

  return (
    <div>
      <div className="overflow-x-auto">
        <div
          className="grid w-max min-w-full gap-1"
          style={{ gridTemplateColumns: `2.75rem repeat(${hours.length}, minmax(1.5rem, 1fr))` }}
        >
          {DAY_LABELS.map((day, dayIndex) => (
            <Fragment key={day}>
              <div className="flex items-center text-xs text-muted">{day}</div>
              {hours.map((hour) => {
                const value = hourly[dayIndex]?.[hour] ?? null;
                return (
                  <div
                    key={hour}
                    title={
                      value == null
                        ? `${day} ${hourLabel(hour)}: closed / no data`
                        : `${day} ${hourLabel(hour)}: ${Math.round(value * 100)}% busy`
                    }
                    className="aspect-square rounded-sm"
                    style={{ backgroundColor: value == null ? "var(--linen-2)" : heatColor(value) }}
                  />
                );
              })}
            </Fragment>
          ))}
          <div />
          {hours.map((hour) => (
            <div key={hour} className="text-center text-[0.6rem] text-muted">
              {hourLabel(hour)}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--basil)" }} />
          Not busy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: AMBER }} />
          Usually a little busy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "var(--tomato)" }} />
          As busy as it gets
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "var(--linen-2)" }} />
          Closed / no data
        </span>
      </div>
    </div>
  );
}
