# TubeX Premium UI refresh

## Visual direction
- Dark graphite interface as the first-visit default, with TX yellow as the primary accent.
- Consistent panel, border, surface, and metric treatments across the dashboard and creator tools.
- Search trend charts distinguish Google Web Search (cyan) from YouTube Search (TX yellow).
- Compact channel performance summary now displays the connected channel thumbnail when available.

## AI workspace behavior
- The AI workspace is bounded to the available viewport height.
- The message thread scrolls internally; the composer and top bar remain in place.
- The history and channel-context side panels are constrained to the workspace height.

## Channel artwork
- Feed synchronization now stores `channelThumbnail` in `tubex-ai-channel-context`.
- Dashboard performance and AI context cards display that image, with a safe text/icon fallback.
- Existing achievement profile thumbnail remains a fallback for the dashboard summary.

## Validation
- Modified TSX files passed TypeScript transpilation syntax checks.
- Full typecheck/build was not completed because project dependencies were not installed in this environment; `npm install` timed out.
