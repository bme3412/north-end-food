import Link from "next/link";
export default function TermsPage() {
  return <article className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
    <h1 className="text-3xl font-bold tracking-tight">Terms</h1>
    <div className="mt-6 space-y-5 text-sm leading-7 text-muted">
      <p>North End Food is provided for informational and planning purposes. Menus, prices, availability, and hours can change; confirm important details with the restaurant.</p>
      <p>Temporary Google Maps photos and place information are governed by the <a href="https://cloud.google.com/maps-platform/terms" target="_blank" rel="noreferrer" className="text-primary underline">Google Maps Platform Terms of Service</a> and applicable Google policies.</p>
      <p>Map content is provided by Mapbox and its data providers under their terms. Third-party links do not imply endorsement.</p>
    </div>
    <div className="mt-8 flex gap-4 text-sm"><Link href="/privacy" className="text-primary underline">Privacy</Link><Link href="/" className="text-primary underline">Return home</Link></div>
  </article>;
}
