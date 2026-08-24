const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PopularityChart({ weekly }: { weekly: number[] }) {
  return (
    <div className="flex items-end gap-3 pt-2">
      {DAYS.map((day, index) => {
        const value = weekly[index] ?? 0;
        return (
          <div key={day} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-24 w-full items-end rounded-t-md bg-linen-2">
              <div
                className="w-full rounded-t-md bg-basil"
                style={{ height: `${Math.round(Math.max(0.04, value) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted">{day}</span>
          </div>
        );
      })}
    </div>
  );
}
