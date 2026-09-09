# Museum Mood — motion gallery

The default route `/` and alternate `/motion` route show the motion gallery. The original caption/download experience is preserved at `/classic`, including all eight original paintings. Classic share links now point to that route.

## Collection and interactions

- Six verified public-domain Met paintings, four enabled moods, ten labeled expressions.
- Every enabled mood now has three paintings: judging (Rubens, Degas, Rembrandt), suspicious (Georges de La Tour, Sargent, Sweerts), confused (Eakins, Greuze, Savoldo), and panicking (Cot, Brouwer, Homer).
- Hover magnification is desktop-only, 22%, 240ms. Reduced motion disables it.
- Within a painting, expression selection and swiping animate the camera instead of replacing the image. Full-painting view shows numbered face targets for the landscape multi-face work.
- Pointer pinch/pan, Safari gesture compatibility, trackpad wheel pinch, keyboard navigation, focus restoration, loading/retry states and reduced motion are supported.
- No AI animation, uploads or account required. Labels are contemporary interpretations, not historical descriptions.

## Extending the gallery

`data/motion-catalog.json` holds artwork metadata, local thumbnail/detail paths, dimensions and default eye crop. `lib/motion.ts` separates mood definitions from reaction spots. Each spot has a stable ID, artwork ID, original label, and optional crop or full-painting framing.

To enable another mood, add 1–3 artwork IDs and a featured ID to its definition, supply reaction spots, then add its existing mood ID to `enabledMoodIds`. Other moods remain hidden. The shell supports all eight.

Crops use normalized top-left x/y and image-relative width, with a 16:9 viewport. Camera state uses a normalized center and visible image width. GSAP writes transforms directly without per-frame React rendering.

## Validation

- `node scripts/motion-catalog.mjs --verify`: live Met public-domain status, painting identity, image and official source verification.
- `node scripts/test-motion.mjs`: six artworks, ten unique expressions, eight mood definitions, enabled mood membership, camera/crop bounds, navigation and image variants. Generates an ignored development-only fixture.
- `node scripts/serve-motion-fixture.mjs`: serves the eight-mood/200%-text/reduced-motion/image-error fixture at http://127.0.0.1:3001/; never included in the production build.
- `node scripts/test-exports.mjs`: original eight JPEG exports, caption edge cases and clipboard/share fallbacks.
- `npx tsc --noEmit`, scoped `npx oxlint app/motion lib/motion.ts`, and `npm run build`.
- Browser checked: multi-face camera transitions, full-painting face targets, all new reaction crops, default homepage and classic route, phone-sized controls. Prior MVP checks cover keyboard, 200% text, reduced motion and error retries.
- Physical iPhone/Android pinch performance and physical Safari/Chrome trackpad gestures remain unverified. Do not claim a measured device frame rate.

Run `npm run dev` for a local preview.
