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
        message="We don't have an AI-generated review summary for this restaurant yet. See Data sources below for details."
      />
    );
  }

  return (
    <div className="rounded-xl border border-line bg-card p-5 shadow-[0_1px_4px_rgba(23,27,32,0.05)]">
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
