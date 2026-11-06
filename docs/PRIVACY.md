# Data privacy & security note — Udyam Digital

**Scope.** Prototype handling synthetic data as if it were real customer data, designed to the Digital Personal Data Protection Act, 2023 (DPDP).

## Consent (DPDP s.6)
- Shown **before** any document is uploaded or read. Plain language, in the owner's chosen language, covering what is collected, why, how long it is kept, and the owner's rights.
- **Separate purposes:** KYC verification (required for the order), order updates (optional, on by default), offers (optional, off by default). No bundled consent.
- Stored with notice version (`UD-KYC-2026-1`), purposes, language and timestamp in `consents`; every change is written to `audit_log`.
- **Withdrawal** is one click on the verification page; it deletes the stored KYC results for that application.

## Purpose limitation & data minimisation
- The advisor collects only business facts needed to recommend a bundle (type, city, staff, sites, current internet, needs, optional GSTIN). No personal ID is asked for until KYC.
- **Document images are processed in memory** (multer memory storage → Tesseract) and **never written to disk or the database**.
- Only the verification outcome is persisted: per-check pass/fail, registry status, trade name, address, and **masked** identifiers (GSTIN `37LD•••••••F1ZB`, ID `SYN-ID-••••40`, consumer no. `•••••••581`). The full GSTIN is not stored with the KYC record.
- Mobile number is stored masked (`••••••3210`) on the application.
- The LLM receives business facts only — never document images, ID numbers or mobile numbers.

## Accuracy & fairness
- OCR results are cross-checked against the (mock) registries and the GSTIN check digit, and the owner sees exactly what was read ("What we read") and why a check failed, with a fix action — no silent rejections.
- Eligibility is rule-based and explained ("Needs an active GSTIN", "Offered to businesses with 10+ employees").

## Retention
- KYC results: kept for the contract duration plus the period telecom KYC rules require; deleted earlier on consent withdrawal (implemented). Abandoned applications: proposed 90-day purge job (not built in prototype).

## Security
- Server-side OCR — no third-party document processing.
- Registry lookups are mock and labelled as such; production would call GSTN/Udyam APIs over mutual TLS with audit trails.
- Inputs validated server-side (file size ≤ 6 MB, ≤ 6 files, image types; quote and order re-validated on the server, never trusted from the client).
- Secrets via environment variables (`GEMINI_API_KEY`), never shipped to the browser.
- Production hardening not in prototype: authentication for the console (SSO + role-based access), rate limiting, encryption at rest for SQLite/managed DB, data-principal access/correction requests via a portal.
