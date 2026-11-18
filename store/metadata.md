# Estimate Maker, App Store metadata (1.0.0)

Everything here is pasted into App Store Connect by Brian and Cowork. No em dashes anywhere, no brand, store or bank names, no "Unlock", "Premium", "Seamless", "Effortless", "Welcome", "Let's", "Professional-grade" or exclamation marks.

App record: bundle id com.bwk.estimatemaker, SKU estimatemaker, ASC app id 6835862478 (eas.json `ascAppId`). RevenueCat public iOS key in app.json `extra.revenueCatApiKeyIos`. Expo project bkdeveloper123/estimatemaker (projectId 856ac8c1-33de-48e9-a845-64e9cd7354a3, app.json `extra.eas.projectId`).

## Name (30/30)
Estimate Maker & Receipt Maker

Accepted in App Store Connect as written. Home screen name and in-app name (app.json `name`): Estimate Maker.

## Subtitle (30/30)
Invoice Generator, Quote Maker

## Keywords, English (U.S.) (100/100)
bid,proposal,billing,bill,contractor,handyman,work,order,job,pdf,template,tax,sign,offline,quotation

Rule: no word from the name or the subtitle (estimate, maker, receipt, invoice, generator, quote), no repeats. Apple combines words across the name, subtitle and keywords, so "invoice maker", "receipt maker", "quote maker", "estimate maker", "bid proposal", "invoice template", "work order", "contractor invoice", "handyman estimate", "receipt pdf", "sign estimate" and "bill maker" are all covered without repeating a word. Counted with node: 100 characters, 15 words.

## Promotional text (153/170)
Price the job on site, get it signed on your phone, and send the invoice and the receipt from the same lines. Your logo on clean PDFs. No account needed.

## Description
Estimates, quotes, invoices and receipts with your own business details, made on your iPhone.

Built for contractors, tradespeople, freelancers and small shops. Price the job on site, hand the phone to your client to sign, turn the estimate into an invoice with one tap when the work is done, and send the receipt when it is paid.

ONE DOCUMENT, FOUR TYPES
• Estimates, quotes, invoices and receipts, each with its own number sequence and prefix (EST-0001, INV-0001)
• One tap turns an estimate or quote into an invoice with every line, and an invoice into a receipt
• Duplicate any document for the next job
• Status: draft, sent, accepted, paid; overdue invoices stand out

YOUR BUSINESS ON EVERY PAGE
• Your name, logo, address, phone, email and tax or license number
• Your saved signature on the business line
• Sign here: your client signs on your phone, with their name and the date

LINE ITEMS THAT ADD UP
• Quantity, unit and rate on every line
• Tax per line, discount as a percent or an amount, a deposit or what was paid, and the balance due
• A saved price list of your usual work and parts, added in one tap
• A client list, with what each client owes
• Notes and terms, with your own defaults

CLEAN PDFS
• Three templates, Ledger, Banner and Plain, each with one accent color
• US Letter or A4
• Share, Mail with the PDF attached, or Print
• Your currency and number format, from your iPhone, with a currency picker

KNOW WHERE YOU STAND
• The month's billed total and what is unpaid, on the first screen
• Search by client, number or amount; filter by type, status and client

PRIVATE AND OFFLINE
• No account, no sign-in, no cloud
• Everything stays on your iPhone and works in airplane mode

ESTIMATE MAKER PRO
Free: unlimited drafts, clients and saved items, and your first two PDFs. Pro sends as many PDFs as you need: weekly with a free trial for new subscribers, yearly, or lifetime with one payment. Documents you made are always yours to open and edit.

Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://bkdigitalleads-cmyk.github.io/estimatemaker/privacy.html

## What's New (1.0.0)
First version. Estimates, quotes, invoices and receipts with your own business details, one tap from estimate to invoice to receipt, signatures on the phone, and clean PDFs.

## Category
Primary: Business. Secondary: Productivity.

## Age rating
4+. Every content question is None.

## App Privacy (nutrition label)
Purchases (Purchase History), used for App Functionality, not linked to the user's identity, not used for tracking. RevenueCat keeps the purchase history under an anonymous app user id to confirm Pro. Nothing else is collected: documents, clients, items, the logo and signatures stay in SQLite on the device. No account, no analytics. The privacy page says exactly this.

Permissions: none at install. The logo comes through Apple's photo picker, which needs no Photos permission. No camera, microphone, location or contacts. One local notification, the trial reminder, asked on the onboarding reminder screen.

## Pricing and RevenueCat
- Subscription group "Estimate Maker Pro".
- `estimate_pro_weekly`: auto-renewing weekly, $6.99/week, 3-day free trial (introductory offer). RevenueCat package `$rc_weekly`. Listed first and preselected on both paywalls.
- `estimate_pro_yearly`: auto-renewing yearly, $39.99/year. RevenueCat package `$rc_annual`.
- `estimate_pro_lifetime`: non-consumable, $79.99 one time. RevenueCat package `$rc_lifetime`.
- RevenueCat: entitlement `pro` (attach all three products), offering `default` with the three packages.
- Prices and trial text in the app always come from StoreKit through RevenueCat.

## App Review contact and support
- Support URL: https://bkdigitalleads-cmyk.github.io/estimatemaker/support.html
- Marketing URL: https://bkdigitalleads-cmyk.github.io/estimatemaker/
- Privacy Policy URL: https://bkdigitalleads-cmyk.github.io/estimatemaker/privacy.html
- Contact email: bkdigitalleads@gmail.com. Settings in the app has "Email support", which opens Mail with the subject "Estimate Maker support".

## App Review note (paste into ASC, Notes)
Estimate Maker makes estimates, quotes, invoices and receipts on the device. There is no account, sign-in or server; documents are stored in SQLite on the device and leave it only when the user shares, mails or prints a PDF. Every document prints the user's own business details; the app ships no templates that imitate a store, brand or bank.

First launch: four short screens that show the app, then "Make your first estimate": type a business name, a line of work and a price, and tap See the estimate to see it as its PDF page (or tap Skip for now). If the Apple ID can still get the free trial, two screens explain the trial and its reminder (the reminder screen may ask for notification permission, used only for one local reminder the day before a trial ends). Then the paywall opens; the close button (X, top right) appears after 3 seconds. Closing it shows a small sheet ("Your first two PDFs are free") and the app opens on the estimate just made.

Free: unlimited drafts, clients and saved items, editing, converting, duplicating, signing and the on-screen PDF preview, and the first two PDFs sent (share, Mail or Print). After that, sending a new PDF opens the in-app paywall; documents already made stay open and editable, and a PDF that already went out free can go out again. Pro: weekly with a 3-day free trial, yearly, and a one-time lifetime purchase. Restore purchases is on both paywalls and in Settings.

To try it: tap New document, Estimate. Pick a client (type a name and tap Add), add a line, then tap Make invoice at the bottom; on the invoice tap Make receipt. Tap Send on any document to see the PDF and the Share PDF, Mail and Print buttons. Sign here is in the Signatures section of an estimate.

## Screenshots (store/screenshots/, made by `node store/screenshots.js`)
6.3 inch at 1206x2622 and 6.9 inch at 1320x2868, six each, in this order, from the app's own screens (store/screens/, rendered at 3x). The caption at the top carries the search terms, in IBM Plex Sans Condensed on the app's manila background; no device frames, gradients or emoji. Sample content is a made-up carpentry business and plain people's names.
1. "Estimate Maker for Your Business": the PDF preview of an estimate in the Ledger template
2. "Quotes and Estimates in Minutes": the estimate's lines of work and materials
3. "Invoice and Receipt in One Tap": the documents list with the billed and unpaid totals and the status stamps
4. "Signed on the Spot": Sign here with the client's signature over the total
5. "Totals, Tax and Deposits": the totals with discount, tax, deposit and the balance due
6. "Three Clean PDF Templates": the preview in the Banner template, green
