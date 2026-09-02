export type RestaurantSummary = {
  restaurant_id: string;
  name: string;
  slug: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  neighborhood: string;
  establishment_type: string;
  primary_cuisine: string;
  official_website: string | null;
  official_menu_url: string | null;
  photo_url: string | null;
  active: boolean;
  open_now: boolean | null;
  hours_summary: string | null;
};

export type CategoryMedian = {
  category: string;
  restaurant_median: string | null;
  north_end_median: string | null;
};

export type PriceProfile = {
  restaurant_median: string | null;
  north_end_median: string | null;
  pct_vs_median: number | null;
  categories: CategoryMedian[];
};

export type ProvenanceEntry = {
  label: string;
  source: string;
  status: "connected" | "not_connected";
  detail: string | null;
  confidence: number | null;
};

export type RestaurantDetail = RestaurantSummary & {
  secondary_cuisines: string | null;
  last_verified_at: string | null;
  reservation_url: string | null;
  item_count: number;

  rating: string | null;
  review_count: number | null;
  price_level: number | null;
  maps_uri: string | null;
  ratings_updated_at: string | null;
  takeout: boolean | null;
  dine_in: boolean | null;
  delivery: boolean | null;

  place_summary: string | null;
  place_summary_disclosure: string | null;
  place_summary_flag_uri: string | null;
  review_summary: string | null;
  review_summary_disclosure: string | null;
  review_summary_flag_uri: string | null;
  reviews_uri: string | null;

  busyness_percent: number | null;
  weekly_popularity: number[] | null;
  hourly_popularity: (number | null)[][] | null;
  crowd_updated_at: string | null;
  weekly_popularity_updated_at: string | null;
  busiest_day: string | null;
  quietest_day: string | null;
  peak_hours_text: string | null;

  price_profile: PriceProfile;
  provenance: ProvenanceEntry[];
};

export type MenuItem = {
  menu_item_id: string;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_slug: string;
  raw_name: string;
  raw_description: string | null;
  raw_price_text: string | null;
  price: string | null;
  currency: string;
  menu_section: string | null;
  canonical_category: string | null;
  canonical_dish: string | null;
  protein: string[] | null;
  pasta_type: string | null;
  sauce: string | null;
  preparation: string | null;
  ingredients: string[] | null;
  dietary_tags: string[] | null;
  portion: string | null;
  size: string | null;
  pizza_serving: "slice" | "whole" | "unknown" | null;
  seasonal: boolean;
  market_price: boolean;
  available: boolean;
  normalization_confidence: string | null;
  north_end_median_price: string | null;
  pct_vs_median: number | null;
  open_now: boolean | null;
  hours_summary: string | null;
  rating: string | null;
  review_count: number | null;
  price_level: number | null;
  takeout: boolean | null;
  dine_in: boolean | null;
  delivery: boolean | null;
  menu_snapshot_id: string;
  retrieved_at: string | null;
  source_url: string | null;
  source_badge: string;
  latitude: number | null;
  longitude: number | null;
  establishment_type: string | null;
  primary_cuisine: string | null;
  address: string | null;
  photo_url: string | null;
};

export type PlaceMatch = {
  restaurant_id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  establishment_type: string;
  primary_cuisine: string | null;
  match_count: number;
  lowest_price: string | null;
  lowest_price_pct_vs_median: number | null;
  sample_name: string;
  photo_url: string | null;
  open_now: boolean | null;
  hours_summary: string | null;
  rating: string | null;
  review_count: number | null;
  price_level: number | null;
  takeout: boolean | null;
  dine_in: boolean | null;
  delivery: boolean | null;
};

export type MenuItemList = {
  total: number;
  items: MenuItem[];
  places: PlaceMatch[];
  parsed_tokens: string[];
  parsed_pizza_serving: "slice" | "whole" | null;
  resolved_category: string | null;
  resolved_dish: string | null;
  resolved_restaurant_id: string | null;
  resolved_restaurant_name: string | null;
};

export type RestaurantSuggestion = {
  restaurant_id: string;
  name: string;
  photo_url: string | null;
  primary_cuisine: string | null;
};

export type DishSuggestion = {
  canonical_dish: string;
  canonical_name: string;
  category: string;
  restaurant_count: number;
};

export type SearchSuggestions = {
  restaurants: RestaurantSuggestion[];
  dishes: DishSuggestion[];
};

export type GooglePhotoAuthor = { display_name: string | null; profile_uri: string | null; avatar_uri: string | null };
export type GooglePhoto = {
  source: "google_maps";
  image_url: string;
  width_px: number | null;
  height_px: number | null;
  google_maps_uri: string;
  flag_content_uri: string | null;
  authors: GooglePhotoAuthor[];
};

export type SimilarDish = {
  canonical_dish: string;
  canonical_name: string;
  restaurant_count: number;
  median_price: string | null;
};

export type SimilarDishesResponse = {
  dishes: SimilarDish[];
};

export type CategoryDish = {
  canonical_dish: string;
  canonical_name: string;
  pizza_serving: "slice" | "whole" | "unknown" | null;
  restaurant_count: number;
  min_price: string | null;
  max_price: string | null;
  median_price: string | null;
};

export type CategorySummary = {
  category: string;
  total_items: number;
  restaurant_count: number;
  dishes: CategoryDish[];
  uncategorized_count: number;
};

export type FilterMeta = {
  categories: string[];
  subcategories: string[];
  proteins: string[];
  dietary: string[];
  ingredients: string[];
  ingredient_categories: string[];
  min_price: number | null;
  max_price: number | null;
};
