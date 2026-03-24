# Design Unification Discussion Log

## Goal
Align desktop (vibe-on) and mobile (vibe-on-android) to one Material 3 expressive language without redesigning layouts.

## Round 1 - Typography Unification (M PLUS Rounded 1c)

### Designer Position
- Keep one expressive font family for brand recognition.
- Use M PLUS Rounded 1c across both apps, not mixed with unrelated display/body families.
- Preserve hierarchy by weight and size, not by swapping families.

### Developer Position
- Full replacement is safe if we keep existing sizing, spacing, and component structure.
- Existing `font-outfit` utility can be retained as a token alias to avoid mass class rewrites.
- Android currently mixes M PLUS, Roboto Flex, and Norline; unifying to one family reduces visual drift.

### Discussion Outcome
- Agreed to use M PLUS Rounded 1c as the shared family on desktop and mobile.
- Kept current layout, spacing, and Material 3 component behavior unchanged.
- Replaced family tokens/overrides only where needed for consistency.

### Round 1 Implemented Changes
- Desktop web global font import switched to M PLUS Rounded 1c.
- Desktop web font token alias (`--font-outfit`) now resolves to M PLUS Rounded 1c for minimal disruption.
- Desktop immersive view inline font override updated to M PLUS Rounded 1c.
- Android Material typography now uses M PLUS Rounded 1c for display/body/label roles.
- Android pairing + onboarding screens now use shared M PLUS family in places previously using Norline/SansSerif.

### Validation Notes
- Android Kotlin compile: successful.
- Web type check/build still reports an existing unrelated error in `src/store/mobileStore.ts`.

### User Judgment Principle
Final usability judgment remains with end users; this round intentionally prioritizes consistency while preserving familiar interaction patterns.

## Round 2 - Color + Widget Harmonization

### Designer Position
- Fallback colors should feel like Material 3 expressive, not a separate technical skin.
- Desktop default theme and Android widget fallback must visually belong to the same family.
- Keep dynamic album-based theming behavior; only align baseline/fallbacks.

### Developer Position
- Best low-risk path is token-level fallback alignment, not component redesign.
- Aligning baseline surfaces and semantic roles (`primary`, `secondary`, containers, outlines) gives cross-platform consistency without changing interactions.
- Widget fallback should use the same semantic palette as the app so no jarring color jump appears when extraction fails.

### Discussion Outcome
- Adopted one shared expressive dark fallback palette for desktop defaults and widget fallback.
- Preserved dynamic theming from album art and all existing component layouts.
- Kept Material 3 semantics intact while removing high-contrast technical fallback accents.

### Round 2 Implemented Changes
- Desktop CSS default Material tokens updated to expressive dark fallback colors.
- Desktop `themeStore` fallback palette updated to the same token family.
- Desktop `surface-container-highest` utility now references the proper token variable.
- Android widget fallback colors in `WidgetUpdater` aligned to the same expressive palette.
