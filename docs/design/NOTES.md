# Estimate Maker design notes (1.0.0, Nov 17, 2026)

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
