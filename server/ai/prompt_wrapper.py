"""
Prompt engineering for keycap generation.

Wraps user prompts with keyboard-specific context to steer
Meshy AI output toward keycap-appropriate geometry.
"""

from __future__ import annotations

# Style presets users can pick from instead of writing a prompt
STYLE_PRESETS: dict[str, str] = {
    "minimal": "clean matte surface, smooth edges, modern minimalist design",
    "industrial": "brushed metal texture, exposed fastener details, raw industrial aesthetic",
    "organic": "natural stone or wood grain texture, organic flowing surface",
    "retro": "vintage rounded profile, cream and beige palette, 1980s computer terminal aesthetic",
    "cyberpunk": "neon accent lines on dark chrome surface, geometric circuit patterns",
    "brutalist": "raw concrete texture with visible aggregate, heavy geometric form",
    "ceramic": "glazed ceramic surface, subtle crackle finish, handcrafted pottery feel",
    "crystal": "translucent crystalline structure, faceted gemstone geometry, light-catching edges",
}

SYSTEM_PREFIX = (
    "A single mechanical keyboard keycap viewed from a 3/4 angle. "
    "The keycap is a Cherry MX profile, approximately 18mm wide and 8mm tall. "
    "The style is: "
)

SYSTEM_SUFFIX = (
    " The keycap has clean edges and solid geometry suitable for 3D printing. "
    "No background, centered composition, single isolated object."
)

NEGATIVE_PROMPT = (
    "multiple objects, background scene, text, watermark, "
    "human, hand, finger, keyboard, full keyboard, "
    "blurry, low quality, noisy"
)


def wrap_prompt(
    user_prompt: str | None = None,
    preset: str | None = None,
) -> tuple[str, str]:
    """
    Build a wrapped prompt for Meshy from user input.

    Returns (positive_prompt, negative_prompt).
    """
    if preset and preset in STYLE_PRESETS:
        style_text = STYLE_PRESETS[preset]
    elif user_prompt:
        style_text = user_prompt
    else:
        style_text = "smooth matte black surface"

    positive = f"{SYSTEM_PREFIX}{style_text}.{SYSTEM_SUFFIX}"
    return positive, NEGATIVE_PROMPT


def get_available_presets() -> list[dict[str, str]]:
    """Return available style presets for the frontend."""
    return [
        {"id": preset_id, "description": desc}
        for preset_id, desc in STYLE_PRESETS.items()
    ]
