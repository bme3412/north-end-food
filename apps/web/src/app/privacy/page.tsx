import Link from "next/link";
export default function PrivacyPage() {
  return <article className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
    <h1 className="text-3xl font-bold tracking-tight">Privacy</h1>
    <div className="mt-6 space-y-5 text-sm leading-7 text-muted">
      <p>North End Food is a neighborhood menu-discovery project. Saved dishes and restaurants are stored in your browser and are not tied to an account.</p>
      <p>The site uses Vercel Analytics and Mapbox. Those providers may process technical request and device information under their policies.</p>
      <p>When a restaurant lacks an owned photo, the site may request a temporary photo from Google Maps Platform. Google may process request and device information under the <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-primary underline">Google Privacy Policy</a>.</p>
      <p>No Google photo, photo resource name, photo URL, or image bytes are intentionally persisted. Manually approved Place IDs may be retained.</p>
    </div>
    <div className="mt-8 flex gap-4 text-sm"><Link href="/terms" className="text-primary underline">Terms</Link><Link href="/" className="text-primary underline">Return home</Link></div>
  </article>;
}
