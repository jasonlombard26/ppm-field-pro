# Local configuration importer checkpoint

**Superseded PDF/workbook status:** the completed [wiring mapper review](WIRING_IMPORT_REVIEW.md) records the newer PDF mapping, workbook blocked-row classification, 168-test result and remaining gates. The earlier checkpoint evidence below is retained as implementation history.

This follow-on is based on local core feature commit `424f21e0f32b396a31320b62638ee905e42dccc6`, which preserves draft PR13 head `0b7384fde34373c86492b0761d025c08a6810d03`. Branch: `feat/h3c-qld-2202-input-modules-asset-photos`. Local implementation and tests only; no push, PR, merge, deployment, live SQL or production access.

## Delivered behavior

Mobile and desktop Site Information now offer **Import configuration report** to editable-site roles. Choose a local file, review source site/controller, mapped fields, sheet/row provenance and conflicts, select new rows and explicitly confirm the target site before applying. Processing uses a local worker with a 20-second deadline. Report files are not uploaded; selected configuration/provenance enters the existing local-first site JSON and normal sync path.

- Integriti Controller, Door and LAN Module listings: title/header detection, sparse-column preservation, scoped source identities, software class separate from physical manufacturer, configuration status/timestamps separate from inspection results. Zero serials are not identities. Control module/controller serial and context matches avoid a second physical controller; unresolved control modules are blocked.
- PPM **Asset List**: recognized explicit header aliases only, preserved textual IDs and formatted leading zeros. Reporting IDs, compound Point/Zone location and physical input/terminal are distinct. All other tabs are explicitly excluded, including assessments and foreign-site templates. This checkpoint does not create performed maintenance visits, results, fault actions or signoffs.
- Repeat source identities are skipped, with changed field names shown for reconciliation. Manual-name/serial conflicts and duplicate scoped identities are blocked. No existing asset is automatically overwritten. Explicit source controller context takes priority over an optional fallback head end.
- PDF: local text extraction and escaped page-by-page review only. No PDF-derived records can be applied. Gallagher wrapped cells, continuation pages, entities and relationships require actual-layout verification before mapping is implemented. Filenames are not evidence that a report contains Contact ID codes.

## Data and security controls

Source formulas (including cached values) and macros are not executed or imported. Free-text notes and credential columns are excluded from saved import data; known mapped fields with obvious credential labels are skipped. Stored source snapshots contain a whitelist of configuration fields, not original files or raw sheets. Arbitrary text cannot reliably be classified as a secret: source review remains necessary before confirming config data. No device-credential field or credential persistence feature was added.

Bounds: 15 MiB input, 20 worksheets, 10,000 rows, 80 columns, 2,000 candidates, 2,000 characters per cell; ZIP declared expansion capped at 64 MiB total / 32 MiB entry and 2,000 entries; PDF 100 pages / one million extracted text characters. Worker termination bounds parsing time; malformed declarations and parser memory behavior are not a browser process memory sandbox.

UI escapes source text. Apply rechecks editable role, account generation/owner, active site and complete site-data fingerprint. The existing atomic local-storage commit path retains prior state when quota fails; original assets, photos and inspections remain intact. Existing revision/role sync logic is unchanged. Actual multi-session concurrency was not tested.

Approved distributions: SheetJS CE 0.20.3 full (BIFF8 XLS and XLSX) and Mozilla PDF.js 6.4.299 matching legacy library/worker, cmaps, fonts and wasm assets. Official source URLs, hashes and licenses are in `vendor/PARSER-PROVENANCE.json`. PDF archive SHA512 matched registry integrity; all vendored file hashes are checked. No package install scripts, new runtime or optional native canvas package were installed. Run tests with Node >=22.13 (tested with existing Node 24); the local regression dependencies remain those already installed for PR13. HTTP(S) serving is required for worker loading. New importer parser paths are local; existing app CDN dependencies and true offline startup remain separate release gates.

## Verification and remaining gates

Latest combined local run after actual-file calibration: **156 passed, 0 failed, 0 skipped** (132 core regression checks plus 24 importer checks). All 203 vendored distribution files matched recorded size/SHA256 values. Evidence is retained outside the repository in `importer-real-validation-suite.tap` and `importer-vendor-verification.json` alongside the follow-on patch/bundle.

Synthetic fixtures exercise real SheetJS BIFF8/XLSX and real PDF.js text parsing; LinkeDOM exercises UI decisions and mocked worker responses. Tests cover scoped identities, duplicate/repeat imports, manual edits, selected rows, module/controller deduplication, field semantics, escaping, credential omission, format/bounds failures, formula omission, permission/session changes, stale previews, local quota failure and worker timeout. These do not prove real browser worker loading, PDF rendering or Android-PC/live-Supabase behavior. Node PDF.js warns about unavailable optional canvas/DOMMatrix/Path2D; text-only extraction passes without rendering dependencies.

The six original reports were subsequently read successfully from the exact local folder authorized by the user. No originals were changed, and no source contents or extracted customer records were saved into Git or review artifacts. Disposable in-memory apply/repeat checks verified the three Integriti listings: 5 controllers, 92 doors and 90 new hardware records, with 5 control-module rows linking to the controllers (187 assets total, no unresolved controller links). Repeat plans skipped all 187 previously added records and retained the 5 controller links.

The original workbook exposed two explicit header aliases: Equipment Descripton and Physical Location. These are now covered by synthetic tests. Placeholder identifiers such as N/A do not become identities; a valid serial can supply identity instead. On an independent empty target, its asset-list preview yields 83 candidates: 77 add and 6 blocked duplicate-identity rows. Another 90 source rows are explicitly skipped (25 missing description/type; 65 without usable identity); seven other worksheets remain excluded. Confirmation and reconciliation are still required before any customer import. Nothing was saved to an app account or synced during validation.

Both originals yielded PDF text (22 and 10 pages); this verifies extraction only. Automatic Gallagher entity mapping remains unimplemented, and no PDF assets can be applied. Source values, credentials and actual customer layouts are not included in the synthetic fixture suite.

Manual review covered the three new importer source files, loader wiring, tests and dependency provenance/limits. It is not a formal Codex Security scan or exhaustive audit of vendored parser algorithms. The [Security Diff Scan skill](skill://Plugin_1e648473be9c8191a91ac3947151af55/security-diff-scan/SKILL.md) requires the security-diff preflight before review; its required `references/config-preflight.md` could not be read and scan APIs were unavailable. No formal scan, SARIF or formal pass is claimed.

Remaining work: resolve incomplete/ambiguous source rows; Gallagher configuration/relationship mapping; dated maintenance results/faults/actions/evidence mapping; explicit conflict reconciliation; browser/Android worker and offline checks; existing PR13 live SQL/RLS/storage and true concurrency release gates.
