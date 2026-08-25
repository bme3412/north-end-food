from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class RestaurantSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    restaurant_id: str
    name: str
    slug: str
    address: str
    latitude: float | None
    longitude: float | None
    neighborhood: str
    establishment_type: str
    primary_cuisine: str
    official_website: str | None
    official_menu_url: str | None
    photo_url: str | None
    active: bool
    open_now: bool | None = None
    hours_summary: str | None = None


class RestaurantExternalIdOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    provider: str
    external_id: str
    external_url: str | None


class CategoryMedianOut(BaseModel):
    category: str
    restaurant_median: Decimal | None
    north_end_median: Decimal | None


class PriceProfileOut(BaseModel):
    restaurant_median: Decimal | None
    north_end_median: Decimal | None
    pct_vs_median: float | None
    categories: list[CategoryMedianOut] = Field(default_factory=list)


class ProvenanceEntry(BaseModel):
    label: str
    source: str
    status: str  # "connected" | "not_connected"
    detail: str | None = None
    confidence: float | None = None


class RestaurantDetail(RestaurantSummary):
    secondary_cuisines: str | None
    last_verified_at: datetime | None
    reservation_url: str | None = None
    external_ids: list[RestaurantExternalIdOut] = Field(default_factory=list)
    item_count: int = 0

    # Google Places — null until GOOGLE_MAPS_API_KEY is configured and refreshed.
    rating: Decimal | None = None
    review_count: int | None = None
    price_level: int | None = None
    open_now: bool | None = None
    hours_summary: str | None = None
    maps_uri: str | None = None
    ratings_updated_at: datetime | None = None

    # AI-generated summaries from Places API (New) — each must be shown
    # with its own disclosure text per Google's attribution requirement.
    place_summary: str | None = None
    place_summary_disclosure: str | None = None
    review_summary: str | None = None
    review_summary_disclosure: str | None = None
    reviews_uri: str | None = None

    # BestTime — null until BESTTIME_API_KEY is configured and refreshed.
    busyness_percent: int | None = None
    weekly_popularity: list[float] | None = None
    crowd_updated_at: datetime | None = None
    weekly_popularity_updated_at: datetime | None = None
    busiest_day: str | None = None
    quietest_day: str | None = None
    peak_hours_text: str | None = None

    price_profile: PriceProfileOut
    provenance: list[ProvenanceEntry] = Field(default_factory=list)


class MenuItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    menu_item_id: str
    restaurant_id: str
    restaurant_name: str
    restaurant_slug: str
    raw_name: str
    raw_description: str | None
    raw_price_text: str | None
    price: Decimal | None
    currency: str
    menu_section: str | None
    canonical_category: str | None
    canonical_dish: str | None
    protein: list[str] | None
    pasta_type: str | None
    sauce: str | None
    preparation: str | None
    ingredients: list[str] | None
    dietary_tags: list[str] | None
    portion: str | None
    size: str | None
    seasonal: bool
    market_price: bool
    available: bool
    normalization_confidence: Decimal | None
    north_end_median_price: Decimal | None = None
    pct_vs_median: float | None = None
    open_now: bool | None = None
    hours_summary: str | None = None
    menu_snapshot_id: str
    retrieved_at: datetime | None = None
    source_url: str | None = None
    source_badge: str = "OFFICIAL MENU"
    latitude: float | None = None
    longitude: float | None = None
    establishment_type: str | None = None
    address: str | None = None
    photo_url: str | None = None


class PlaceMatch(BaseModel):
    restaurant_id: str
    name: str
    address: str
    latitude: float | None
    longitude: float | None
    establishment_type: str
    match_count: int
    lowest_price: Decimal | None
    sample_name: str
    photo_url: str | None = None
    open_now: bool | None = None
    hours_summary: str | None = None


class MenuItemList(BaseModel):
    total: int
    items: list[MenuItemOut]
    places: list[PlaceMatch] = Field(default_factory=list)
    parsed_tokens: list[str] = Field(default_factory=list)
