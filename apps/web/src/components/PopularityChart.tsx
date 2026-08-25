const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PopularityChart({ weekly }: { weekly: number[] }) {
  const busiestIndex = weekly.reduce(
    (best, value, index) => (value > (weekly[best] ?? -1) ? index : best),
    0,
  );

  return (
    <div>
      <p className="text-xs text-muted">Relative busyness by day (0-100%, BestTime&apos;s scale)</p>
      <div className="flex items-end gap-3 pt-3">
        {DAYS.map((day, index) => {
          const value = weekly[index] ?? 0;
          const percent = Math.round(value * 100);
          const isBusiest = index === busiestIndex;
          return (
            <div key={day} className="flex flex-1 flex-col items-center gap-1.5">
              <span className={`text-xs font-semibold ${isBusiest ? "text-tomato" : "text-ink"}`}>{percent}%</span>
              <div className="flex h-24 w-full items-end rounded-t-md bg-linen-2">
                <div
                  className={`w-full rounded-t-md ${isBusiest ? "bg-tomato" : "bg-basil"}`}
                  style={{ height: `${Math.round(Math.max(0.04, value) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted">{day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
