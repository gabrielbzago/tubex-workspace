# TubeX v8 — Visual polish fixes

## Correções desta revisão
- Restored explicit visualization colors for subscriber health, churn, propensity tiers, plan distribution and cancellation reasons. The previous dashboard referenced `--viz-*` tokens that were not defined, so SVG donut strokes rendered without their intended palette.
- Replaced the remaining undefined chart color token used by conversion meters with the TX gold accent.
- Redesigned achievement library tiles as tier-specific medal cards (Bronze, Silver, Gold, Platinum), with metallic emblem, ribbon, glow, unlocked/locked states and clearer progress hierarchy.
- Preserved existing data, API calls, filters, unlock logic, progress values and sharing behavior.

## Files changed
- `components/admin-subscriber-behavior.tsx`
- `components/achievements-center.tsx`
- `app/globals.css`

## Validation
- Source changes were reviewed and TypeScript compiler parsing was attempted.
- Full typecheck/build is not available in this workspace because project dependencies (`node_modules`) are not installed. Run `npm install` followed by `npm run typecheck` and `npm run build` in the project environment before deployment.
