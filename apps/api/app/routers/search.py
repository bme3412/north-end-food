from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.queries import suggest_search
from app.schemas.menu import DishSuggestionOut, RestaurantSuggestionOut, SearchSuggestionsOut

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/suggest", response_model=SearchSuggestionsOut)
def suggest(
    q: str | None = Query(None, description="Partial query. Empty or under 2 characters returns no suggestions."),
    db: Session = Depends(get_db),
) -> SearchSuggestionsOut:
    result = suggest_search(db, q)
    return SearchSuggestionsOut(
        restaurants=[
            RestaurantSuggestionOut(
                restaurant_id=row.restaurant_id,
                name=row.name,
                photo_url=row.photo_url,
                primary_cuisine=row.primary_cuisine,
            )
            for row in result.restaurants
        ],
        dishes=[
            DishSuggestionOut(
                canonical_dish=row.canonical_dish,
                canonical_name=row.canonical_name,
                category=row.category,
                restaurant_count=row.restaurant_count,
            )
            for row in result.dishes
        ],
    )
