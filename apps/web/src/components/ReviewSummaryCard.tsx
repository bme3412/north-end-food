import { GoogleMapsAttribution } from "@/components/GoogleMapsAttribution";
import { NotConnectedCard } from "@/components/NotConnectedCard";
const ABOUT_SUMMARIES = "https://support.google.com/local-listings/answer/9851099";

export function ReviewSummaryCard({ summary, disclosure, flagUri, reviewsUri }: { summary: string | null; disclosure: string | null; flagUri: string | null; reviewsUri: string | null }) {
  if (!summary || !disclosure || !flagUri || !reviewsUri) {
    return <NotConnectedCard title="No review summary yet" message="A summary is shown only when Google supplies its required disclosure, reporting link, and review link." />;
  }
  return (
    <div className="rounded-xl border border-line bg-card p-5 shadow-[0_1px_4px_rgba(23,27,32,0.05)]">
      <p className="text-[0.95rem] leading-relaxed">{summary}</p>
      <p className="mt-2 text-xs text-muted">{disclosure}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <a href={ABOUT_SUMMARIES} target="_blank" rel="noreferrer" className="text-basil underline">About this summary</a>
        <a href={flagUri} target="_blank" rel="noreferrer" className="text-basil underline">Report summary</a>
        <a href={reviewsUri} target="_blank" rel="noreferrer" className="text-basil underline">See reviews on Google Maps</a>
        <GoogleMapsAttribution href={reviewsUri} />
      </div>
    </div>
  );
}
