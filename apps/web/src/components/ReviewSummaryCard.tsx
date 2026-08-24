import { NotConnectedCard } from "@/components/NotConnectedCard";

export function ReviewSummaryCard({
  summary,
  disclosure,
  reviewsUri,
}: {
  summary: string | null;
  disclosure: string | null;
  reviewsUri: string | null;
}) {
  if (!summary) {
    return (
      <NotConnectedCard
        title="No review summary yet"
        message="Google's Places API generates this directly (reviewSummary) once GOOGLE_MAPS_API_KEY is set and scripts/refresh_place_stats.py has run — it isn't guaranteed for every place, so this can stay empty even once connected."
      />
    );
  }

  return (
    <div className="rounded-3xl border border-line bg-card p-5">
      <p className="text-[0.95rem] leading-relaxed">{summary}</p>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted">
        {/* Google requires this exact attribution whenever an AI-generated summary is shown. */}
        <span>{disclosure ?? "Summarized with Gemini"}</span>
        {reviewsUri ? (
          <a href={reviewsUri} target="_blank" rel="noreferrer" className="font-medium text-basil underline underline-offset-2">
            See reviews on Google Maps
          </a>
        ) : null}
      </div>
    </div>
  );
}
