import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

describe("Google content boundaries", () => {
  it("keeps Google photos and derived place content out of the Mapbox popup", () => {
    const map = source("src/components/MapView.tsx");
    expect(map).not.toContain("attributionControl={false}");
    expect(map).toContain("allowGoogle={false}");
    expect(map).not.toContain("detail?.rating");
    expect(map).not.toContain("detail?.place_summary");
    expect(map).not.toContain("place.takeout");
  });

  it("loads ephemeral fallback images lazily without Next optimization", () => {
    const photo = source("src/components/RestaurantPhoto.tsx");
    expect(photo).toContain("IntersectionObserver");
    expect(photo).toContain("getGooglePhoto");
    expect(photo).toContain("googlePhoto.image_url");
    expect(photo).toContain("Source photo");
    expect(photo).toContain("Report photo");
  });
});
