# Estimate Maker design notes (1.0.0, Nov 17, 2026)

## Concept: the job ticket

The person opening this app is standing in someone's kitchen or driveway with a tape measure in their pocket. Their paperwork has always been a pad of carbonless tickets on a clipboard: printed field labels, ruled lines, a total underlined twice, a number stamped in the corner and a rubber stamp for PAID. So the app is that pad, not a dashboard.

- The clipboard (the background) is manila, #EEE8DC. The tickets (lists, forms, the totals) are paper, #FCFAF5. Ink is near-black, #1C1B19. The pages of a document are white, as they print.
- One accent, tape-measure orange (#C9480B, white text at 4.7:1), and it means one thing: the main action on the screen (New document, Send, Share PDF, Done, Continue). Picked choices are ink, not orange; switches are ink; stamps are their own colors (green for paid and accepted, red for overdue).
- Type, IBM Plex, the same family the PDFs are set in: Plex Sans Condensed SemiBold for screen titles, field labels in capitals with a rule running out to the edge ("CLIENT ————"), the main button's lettering and the tab labels; Plex Mono for every amount and document number, like a numbering machine, so columns of money line up; the system font for everything people type and read in sentences.
- No generic cards. The home screen's two numbers sit on a ticket stub with a perforation between them and a torn bottom edge. The documents are lines in a ledger, with a faint orange margin rule: the type and date in the margin, the client and number, the amount and a rubber stamp (DRAFT, SENT, ACCEPTED, PAID, or OVERDUE in red). Clients and items are ledger lines too. Totals end with a rule in ink over the total and a double rule over the balance due, as a bookkeeper writes it.
- Corners are small (6 and 4), like cut paper and a tag; quiet buttons and choices are outlined in ink, not filled.
- Dark follows the system: the clipboard goes to night-shift charcoal (#141311), the tickets to carbon (#1F1D1A), ink to warm white, and the orange lifts to #F07A38 with dark lettering. The signing pad and the document pages stay white, because that is what prints.
- Motion is quiet: sheets fade, feedback is by touch (a success tap when a PDF goes out or a signature is saved, a tick on choices).

## Before and after

`before/` is the app at the end of step 5, still in Signature Maker's "clean desk" look; `after/` is the same screens after this pass. Both are 393x852 points at 2x, light and dark, from a throwaway web copy of the app (not in the repo): the real screens, kit, data layer and PDF layout on react-native-web, with expo-sqlite swapped for sql.js running the same SQL, Skia swapped for SVG drawing the same operations with the same font files, a stubbed store with $6.99 weekly with 3 days free, $39.99 yearly and $79.99 lifetime, a drawn status bar and the date pinned to Nov 17, 2026. The signature on Sign here is the sample signature drawn with the mouse. Haptics, Dynamic Type, VoiceOver and the real iOS keyboard are not visible in them.

What the "before" showed, and what changed:

- Every section was a large rounded card on a beige desk: it read as a settings app. Now forms are paper sheets with small corners, labels are condensed capitals with a rule, and lists are ledger lines.
- The home numbers were two figures in a rounded box. Now they are a ticket stub in mono figures with a perforation and a torn edge.
- Titles were Newsreader, a book serif from Signature Maker. A tradesperson's paperwork is lettered, not typeset: titles, labels and the main button are now Plex Sans Condensed, and the serif and its files are gone.
- Amounts used the system font's tabular figures. Now every amount and number is Plex Mono, so a column of prices lines up and the document number looks stamped.
- The accent was Signature Maker's deep blue. Now it is tape-measure orange, and the selected pill is ink instead of a darker beige, so orange never means "selected".
- Number fields could run off the right edge of their row (the tax rate and deposit read "8" and "0" at the edge). The label no longer shrinks and the input can.
- "Preview and send" in capitals did not fit beside "Make invoice"; the button is "Send" with the share glyph, and the preview still opens first.
- The line sheet's Move up, Move down and Remove were cut to "Mov..." and "Rem..."; moving is now two glyph buttons and Remove line has the room.
- The graphite color dot disappeared on the dark background; every color dot has a ring.
- The receipt on the fourth onboarding screen was cropped through the client's name; it now starts at the left edge.

## Icon

Four concepts in `icon-options.png`, each large and at 60 px on a light and a dark wallpaper, drawn by `store/icon.js` (`node icon.js options`; `node icon.js` writes `assets/` and the website images):

1. ticket (chosen): a paper work ticket, tilted a little, with a torn bottom edge, a heavy title bar, ruled lines and the total underlined with an orange tag, on tape-measure orange. It is the only one with a silhouette you can name at 60 px (the torn edge), and the orange tile stands out on both wallpapers and next to blue and green neighbours.
2. carbon: two sheets of a carbonless book, white over canary, with "EST" in orange, on charcoal. Warm and specific, but it disappears on the dark wallpaper.
3. stamp: "PAID" as a rubber stamp. Clear, but it says receipts only, and a pale tile is weak on a light wallpaper.
4. tag: a ruled slip with an orange check mark on black. Reads as a to-do list.

No currency sign (the app is for every currency), no wrench, hammer or hard hat. The splash is the icon tile centred on the manila (light) or charcoal (dark) background.

## The PDFs

Every document is laid out once, by `src/pdf/layout.ts`, as a list of drawing operations on points (text, rules, boxes, the logo, signature paths). pdf-lib draws them into the PDF (`src/pdf/pdf.ts`) and Skia draws the same list on screen (`src/ui/PageView.tsx`) with the same font files, so the preview is the PDF. Text is measured with fontkit exactly as pdf-lib sets it (glyph advances, no kerning or ligatures), and anything the font cannot draw (an emoji in a description) becomes "?" instead of a blank box.

Fonts: IBM Plex (SIL OFL, `assets/fonts/OFL-IBMPlex.txt`): Plex Sans Regular and SemiBold for the text, Plex Sans Condensed SemiBold for the type in capitals ("ESTIMATE") and the totals stamp, Plex Mono for the document number. Plex has tabular figures, so amounts line up in their column, and it carries every currency symbol in the picker (checked by `npm test`). Fonts are subset, so a page is about 50 KB.

Three templates, each with one accent color picked from six that print well and hold white text (navy, green, brick, copper, plum, graphite):

- Ledger: the business top left with its logo, the type in large condensed capitals in the accent top right with the number and dates under it, a heavy accent rule, ruled rows under a solid accent header, and the totals in a boxed column whose last line is the accent band.
- Banner: a band of the accent across the top with the business in white (the logo on a white tile), the type in white capitals; a tinted table header; the last line of the totals on the accent.
- Plain: no fills; wider margins; the type in ink; thin rules; only the last line of the totals and the section labels take the accent.

All three: "Prepared for", "Bill to" or "Received from" with the client's details; description, quantity with its unit, rate and amount; "Not taxed" under a line that is not, when the document has tax; notes and terms beside the totals; subtotal, discount, tax, total, deposit or paid, balance due (or credit); a rubber-stamp "PAID" on paid invoices and receipts; signature lines (the owner's saved signature "For <business>", and "Accepted by" on estimates and quotes, with the client's signature, name and date when they signed on the phone); a footer with the business, the number and "Page 1 of 2". Long documents carry on over pages with a short header and the table header repeated.

Signatures go into the PDF as vector paths (the pen engine's outlines through pdf-lib's drawSvgPath), so they stay sharp at any zoom.

Guardrail: the page prints only what the person typed for their own business. No template imitates a store, brand or bank, and none carries a sample name. The samples in `docs/design/pdf` use a made-up one-person business, "Okafor Carpentry", and plain people's names (src/sampleDoc.ts); a test checks the sample never reaches a real document, and the app will not send a PDF until the business has a name.

Samples (`node store/pdf-samples.mjs`, page 1 as PNG beside each PDF): `pdf-templates.png` shows the three side by side; `pdf/` has ledger, banner and plain on Letter and A4, an estimate signed by the client, an invoice with a deposit, a receipt paid by check, a GBP quote with VAT, a EUR estimate in German formats, an INR invoice with GST, a 34-line invoice over three pages, and a page with no logo and an empty business profile.
