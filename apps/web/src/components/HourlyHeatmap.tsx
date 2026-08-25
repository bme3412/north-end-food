import { Fragment } from "react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function hourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${period}`;
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
    <div className="overflow-x-auto">
      <div
        className="grid w-max min-w-full gap-1"
        style={{ gridTemplateColumns: `2.75rem repeat(${hours.length}, minmax(1.65rem, 1fr))` }}
      >
        <div />
        {hours.map((hour) => (
          <div key={hour} className="text-center text-[0.65rem] text-muted">
            {hourLabel(hour)}
          </div>
        ))}
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
                  style={{
                    backgroundColor:
                      value == null ? "var(--linen-2)" : `color-mix(in srgb, var(--tomato) ${15 + value * 80}%, var(--card))`,
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span>Quiet</span>
        <div className="flex h-3 w-24 overflow-hidden rounded-full">
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <div key={v} className="flex-1" style={{ backgroundColor: `color-mix(in srgb, var(--tomato) ${15 + v * 80}%, var(--card))` }} />
          ))}
        </div>
        <span>Very busy</span>
        <span className="ml-2 flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: "var(--linen-2)" }} />
          Closed / no data
        </span>
      </div>
    </div>
  );
}
