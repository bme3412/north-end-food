import { describe, expect, it } from "vitest";

import { EMPTY_SAVED, parseSavedState } from "./saved";

describe("saved-state persistence", () => {
  it("returns an empty state for missing or invalid storage", () => {
    expect(parseSavedState(null)).toEqual(EMPTY_SAVED);
    expect(parseSavedState("{not-json")).toEqual(EMPTY_SAVED);
  });

  it("keeps valid collections and repairs missing ones", () => {
    expect(parseSavedState(JSON.stringify({ dishes: [{ menu_item_id: "1" }] }))).toEqual({
      dishes: [{ menu_item_id: "1" }],
      restaurants: [],
    });
  });
});
