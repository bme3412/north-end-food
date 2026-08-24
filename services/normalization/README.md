Phase 1 target: map raw item names onto canonical dishes without overwriting raw fields.

Implemented as part of the Gemini extraction call in
`apps/api/app/extraction/` — canonical_category/canonical_dish are written
alongside raw_name/raw_description/raw_price_text, never in place of them.
`canonical_dish` is only ever set to a real `canonical_dishes` id (a
hallucinated id gets nulled before insert — see
`app/extraction/pipeline.py::_to_menu_item`), so it's a within-taxonomy
match, not a general normalization engine.
