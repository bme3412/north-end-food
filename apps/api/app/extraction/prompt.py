from app.seed_data import CANONICAL_DISHES

SYSTEM_INSTRUCTION = """You are extracting a restaurant menu into structured data.

Rules:
- Extract ONLY items literally present in the provided text. Never invent dishes, prices, or descriptions.
- If a price is not printed in the text, leave price and raw_price_text null. Do not estimate or guess a price.
- raw_name and raw_description must be copied from the source text, not paraphrased.
- Assign canonical_dish only when the item clearly matches one of the taxonomy entries below by name or alias; otherwise leave it null. Do not invent a taxonomy id that isn't listed.
- confidence (0-1) reflects how certain YOU are that this specific extraction is accurate, not the restaurant's menu quality. Use lower values for ambiguous prices, sections, or categorization.
- Ignore navigation, ordering instructions, addresses, hours, and any non-menu boilerplate that slipped through.
"""


def build_prompt(menu_text: str) -> str:
    taxonomy_lines = "\n".join(
        f"- {dish['canonical_dish_id']}: {dish['canonical_name']} ({', '.join(dish['aliases'])})"
        for dish in CANONICAL_DISHES
    )
    return (
        f"{SYSTEM_INSTRUCTION}\n"
        f"\nCanonical dish taxonomy:\n{taxonomy_lines}\n"
        f'\nMenu text:\n"""\n{menu_text}\n"""'
    )
