# Frontend accessibility audit — 2026-10-18

> Historical scope: this audit covered the frontend-only `/staff`, `/admin`, `/tickets`, and `/display` routes present on 2026-10-18. SPEC-003 replaced the staff, ticket, and display routes with a backend-connected presentation dashboard on 2026-10-19. The muted-text and active-navigation contrast colors were darkened and the brand link now derives its accessible name from its visible label, but this report is not a full WCAG audit of the new dashboard. Its current automated browser checks cover skip-link keyboard focus, reduced motion, and page overflow at 320, 390, 768, 1120, and 1440 CSS px. No axe scan, full success-criteria assessment, or assistive-technology review was run for the dashboard.

## Scope and method

Reviewed the complete current frontend demo at `/staff`, `/admin`, `/tickets`, and `/display`, including the staff action messages, admin save preview, and ticket preview. No backend, persistence, or live queue exists in these screens.

- **Standard:** WCAG 2.2 Level AA, including applicable Level A criteria. The project Render guide says to use the currently applicable WCAG version unless a contract requests a specific version; the W3C maintains the current success criteria at [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- **Automated:** axe-core 4.14.0 injected into the running Vite app through Playwright/Chromium. Scanned `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa` tags.
- **Coverage:** 26 scans: all four routes at 320, 390, 768, 1120, and 1440 CSS px, plus six feedback states at 390 px. Captured and visually inspected full-page screenshots at 390 and 1440 px; inspected the ticket screen at 768 px after the overflow check found an issue.
- **Manual browser checks:** Tab traversal on every route, visible focus styling, page-level horizontal overflow, and WCAG text-spacing overrides (line height 1.5, paragraph spacing 2×, letter spacing 0.12em, and word spacing 0.16em) at 320 px.

This is an audit report, not a conformance claim. Automated checks cannot establish full WCAG conformance; assistive-technology and some visual checks remain open.

## Findings

### Serious — insufficient text contrast (WCAG 1.4.3)

Three foreground styles fail the 4.5:1 normal-text threshold in the live rendered UI:

1. `--muted: #687775` on the canvas `#f4f5f1` measures **4.27:1**. It affects page descriptions and count labels across Staff, Admin, Ticket, and Display views, and remains present in the associated feedback states. See [`index.css`](../../frontend/src/index.css#L11) and the page description styling at line 132.
2. The active navigation subtitle `#627570` on `#f4f5f1` measures **4.46:1**. It appears at widths where the full navigation subtitle is shown. See [`index.css`](../../frontend/src/index.css#L103).
3. The public board’s “QUEUE PREVIEW” eyebrow uses `#586963` on `#17332f` and measures **2.33:1**. The shared eyebrow color was selected for a light background but is also used inside the dark board. See [`DisplayPage.jsx`](../../frontend/src/features/display/DisplayPage.jsx#L15) and [`index.css`](../../frontend/src/index.css#L133).

**Remediation:** darken the muted and active-navigation text colors enough to exceed 4.5:1 on their actual surfaces; give the public-board eyebrow a light foreground token. Re-run axe and verify the rendered pairs, including hover/current states.

### Serious — visible brand label does not match link accessible name (WCAG 2.5.3)

The brand link visibly reads “Queue” and “CLINIC WORKSPACE,” while `aria-label="Clinic queue home"` overrides that text as its accessible name. axe reports `label-content-name-mismatch` on the link on every route. See [`App.jsx`](../../frontend/src/App.jsx#L19).

**Remediation:** remove the unnecessary `aria-label` so the link name comes from its visible content, or make the accessible name include the complete visible label.

### Moderate — named public-board container has no naming-capable role (manual review; likely WCAG 4.1.2)

axe marked `aria-prohibited-attr` as **incomplete**, not a confirmed violation, for `.public-board`: it is a plain `div` with `aria-label="Sample public queue board"`. See [`DisplayPage.jsx`](../../frontend/src/features/display/DisplayPage.jsx#L12). A generic `div` does not reliably expose that label as a named region.

**Remediation:** if this container should be a navigable landmark, use a region-capable semantic element/role with an accessible name; otherwise remove the label. Confirm the resulting landmark and name in an accessibility tree.

### Moderate — Ticket layout overflows at 768 px (responsive issue; WCAG 1.4.10 check passed at 320 px)

At 768 px, the ticket page’s grid columns have 240 px and 290 px minimum widths plus a 22 px gap, exceeding the workspace after its sidebar and padding. The live page scroll width exceeds the viewport and the ticket preview is clipped at the right edge. See [`index.css`](../../frontend/src/index.css#L195). This is a tablet-width layout defect; it did **not** trigger horizontal page overflow at 320 px.

**Remediation:** allow the ticket grid to collapse before its minimum columns exceed the available content width, then repeat the width matrix.

### Minor — mobile navigation clips the last destination label

At 390 px, the horizontal navigation visibly clips “Public display” to “Public di” until the user scrolls the navigation strip. The strip is horizontally scrollable, so this was not page-level overflow and axe did not flag it. See [`index.css`](../../frontend/src/index.css#L246).

**Remediation:** make the overflow affordance clearer or adapt the navigation so all destination names are discoverable without guessing that the strip scrolls.

### Follow-up — compact “Review call action” control

At 390 px, this control measures 118 × 17 CSS px. WCAG 2.2 SC 2.5.8 permits smaller targets when its spacing exception is met; the control appears isolated, but the target-spacing exception was not exhaustively measured across zoom and device conditions. Consider increasing its vertical hit area to at least 24 px and verify the exception if it stays compact.

### Manual review — route location and document title (WCAG 2.4.2, 2.4.5)

All four routes share the document title “Queue — Clinic workspace preview,” and the persistent workspace navigation is the only in-app route-finding mechanism. The title identifies the application but not the current screen. These criteria need product-context review: if each route is treated as a separate page in the set, make its title identify that screen and provide a second way to locate pages; if these routes are steps/results in a process, document that exception and confirm the current treatment is sufficient.

## WCAG 2.2 A/AA criterion coverage

This table records applicability for this static demo and the evidence boundary. Criteria not listed as failures are not thereby certified; use the manual follow-up section for criteria requiring a human or assistive-technology check.

| Criteria | Review outcome |
|---|---|
| 1.1.1 Non-text Content | No informative images in the app views; the brand mark is hidden from assistive technology and rendered text supplies the brand. axe found no alternative-text issue. |
| 1.2.1–1.2.5 Time-based Media | Not applicable; no audio or video. |
| 1.3.1 Info and Relationships; 1.3.2 Meaningful Sequence | Headings, sections, form labels, table caption, and table headers are semantic. The public-board label on a generic `div` remains a role/name review item. |
| 1.3.3 Sensory Characteristics; 1.3.4 Orientation; 1.3.5 Identify Input Purpose | No sensory-only instructions, orientation lock, or personal-information fields were found. |
| 1.4.1 Use of Color | Text labels accompany status colors; the current route also exposes `aria-current`. |
| 1.4.3 Contrast (Minimum) | **Fails** for the three text-color patterns listed above. |
| 1.4.4 Resize Text; 1.4.5 Images of Text | Actual 200% browser text resize was not performed; the UI uses text rather than text images. |
| 1.4.10 Reflow | No page overflow at 320 px in this scan; the separate 768 px Ticket layout overflow is a responsive defect and is tracked above. |
| 1.4.11 Non-text Contrast | Not fully measured for every control boundary and state; no automated axe violation was reported. |
| 1.4.12 Text Spacing | WCAG spacing overrides caused no page-level horizontal overflow on all four routes at 320 px. Overlaps/content loss were not exhaustively checked. |
| 1.4.13 Content on Hover or Focus | No additional hover/focus content or custom popup was present. |
| 2.1.1 Keyboard; 2.1.2 No Keyboard Trap | All focusable controls were reached in Tab order with visible focus; no trap observed. Keyboard activation of every individual action was not exhaustively tested. |
| 2.1.4 Character Key Shortcuts; 2.2.1 Timing Adjustable; 2.2.2 Pause, Stop, Hide; 2.3.1 Three Flashes | No single-character shortcuts, time limits, auto-updating/moving media, or flashing content. |
| 2.4.1 Bypass Blocks; 2.4.3 Focus Order; 2.4.4 Link Purpose; 2.4.6 Headings and Labels; 2.4.7 Focus Visible | Skip link, consistent focus traversal, descriptive headings/navigation labels, and visible focus were observed. Brand link has the separate 2.5.3 issue above. |
| 2.4.2 Page Titled; 2.4.5 Multiple Ways | **Manual review required** as described above: one app-level title and one in-app route-navigation mechanism. |
| 2.4.11 Focus Not Obscured (Minimum) | No fixed overlay obscured a focused target in the tested traversal; zoom and scroll positions were not comprehensively tested. |
| 2.5.1 Pointer Gestures; 2.5.2 Pointer Cancellation; 2.5.4 Motion Actuation; 2.5.7 Dragging Movements | No multipoint/path gestures, motion controls, or drag interactions; controls use native activation patterns. |
| 2.5.3 Label in Name | **Fails** for the visible brand link label, as detailed above. |
| 2.5.8 Target Size (Minimum) | One compact control is 118 × 17 px; verify spacing exception or enlarge as detailed above. |
| 3.1.1 Language of Page; 3.1.2 Language of Parts | Document declares English; no other-language content was observed. |
| 3.2.1 On Focus; 3.2.2 On Input; 3.2.3 Consistent Navigation; 3.2.4 Consistent Identification; 3.2.6 Consistent Help | Focus/input do not unexpectedly navigate; navigation and action labels remain consistent. No help mechanism is provided, so 3.2.6 is not applicable. |
| 3.3.1 Error Identification; 3.3.2 Labels or Instructions; 3.3.3 Error Suggestion; 3.3.4 Error Prevention (Legal, Financial, Data); 3.3.7 Redundant Entry | Form controls have associated labels; no rejected or invalid input state, legal/financial transaction, or multi-step redundant-entry flow exists in this preview. Error-state criteria need re-audit when real forms are added. |
| 3.3.8 Accessible Authentication (Minimum) | Not applicable; no authentication flow. |
| 4.1.2 Name, Role, Value; 4.1.3 Status Messages | Controls and status messages use native semantics/`role="status"`. The generic public-board `aria-label` needs the role/name follow-up noted above. |

## Checks that passed in this run

- Every route’s visible focusable controls were reachable in Tab order: Staff 10, Admin 8, Ticket 8, Display 6. Each focused control showed a visible outline; traversal reached the end without a keyboard trap.
- The 320 px text-spacing stress check produced no page-level horizontal overflow on any route.
- Existing E2E coverage also verifies no page-level horizontal overflow at 390 and 1440 px for all four destinations.
- axe found no other automated violations in its selected WCAG tag set. Per scan, 18–26 axe rules passed; rule counts vary by route. No overall score is reported.
- The axe contrast rule marked some text with pseudo-element or obscured backgrounds “needs review.” Direct checks of the identified foreground/background pairs (light text on evergreen surfaces and dark text on the amber primary button) were above 4.5:1; the arrow glyph was `aria-hidden` and decorative.
- Native form labels, document language/title metadata, semantic headings, table caption/header associations, skip link, `aria-current` route indication, reduced-motion handling, and polite action status messages were present in source/browser inspection.

## Not established / next manual checks

- No VoiceOver, NVDA, or JAWS session was run. Verify spoken route changes, the brand link name, the public-board landmark, table navigation, and live status announcements with a screen reader.
- Actual browser zoom at 200% and 400%, operating-system high-contrast/forced-colors mode, non-text contrast for every control boundary/focus state, and keyboard activation of every action were not fully exercised. The 320 px viewport and text-spacing override are focused proxies, not substitutes for real zoom/assistive-technology testing.
- Loading, API errors, empty live queue, authorization, and real issue/call flows are not present in this frontend-only demo and were not auditable.

The W3C’s [Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/) describes the criteria and evaluation context; this report records the measured frontend evidence and the remaining manual boundaries.
