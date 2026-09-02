import Image from "next/image";

const logo = (
  <Image
    src="/google-maps/GoogleMaps_Logo_DarkGray_1x.png"
    alt="Google Maps"
    width={98}
    height={18}
    className="h-[18px] w-[98px]"
  />
);

export function GoogleMapsAttribution({ href }: { href?: string | null }) {
  const className = "inline-flex shrink-0 items-center whitespace-nowrap";
  if (!href) return <span className={className}>{logo}</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} aria-label="Open in Google Maps">
      {logo}
    </a>
  );
}
