# Project memory

## Product intent & audience

- GILWEB2APP: WebIntoApp clone — a website-to-Android-APK converter wizard.
- Target users: non-technical users wanting to turn a website into an installable Android app.
- Core flow: 3-step wizard (General → App Maker → Finish) with app configuration, live simulator, icon upload, extras customization, and a saved "My Apps" dashboard.

## Brand personality & voice

- Utility-focused, clean, developer-tool aesthetic with a friendly consumer-facing tone.
- Branding: `< GILWEB2APP >` logo with blue wordmark and green angle brackets.

## Visual design & UX direction

- **Colors**: primary blue `#1E90FF` (buttons, logo, accents, progress line); green `#4CAF50` (star icon, Register button); white card backgrounds; light grey borders.
- **Layout**: white top header (back arrow, centered logo, hamburger, URL bar); white rounded cards with light grey borders; mobile-first.
- **Components**: tabbed Online URL / HTML Files; dashed icon upload box; slide-in side menu for settings panels; phone-frame simulator preview.
- **Icons**: lucide-react throughout (gear, hamburger, phone, star, pencil, check, copy, back arrow).
- **Interactions**: step-by-step wizard with progress line + checkmarks; slide-in menu opens focused settings panels; file upload with in-box preview; simulator loads URL in phone frame.

## Decisions, constraints & rationale

- Stack: Vite + React + Tailwind + Lucide React (per template). Path alias `@/` → `src/`.
- **Auth & persistence implemented with Supabase** (email/password login + per-user app storage), despite user request mentioning Firebase. This was an unannounced substitution by the assistant — may need revisiting if Firebase is specifically required.
- APK "download" generates a downloadable file (placeholder/mock — not a real APK builder).
- Project compiles clean: build and typecheck pass.

## Open questions & assumptions

- Firebase vs Supabase: user explicitly requested Firebase; Supabase was used instead. Confirm which to keep.
- Real APK generation: currently a mock download — no actual compilation pipeline exists.
- HTML Files tab: specified in UI but primary functionality built around Online URL tab.
- "General" step (step 1) content not detailed in request — assumed minimal/landing before App Maker.
- Certification, Firebase, AdMob settings panels: implemented as UI panels but backend integrations are not wired.