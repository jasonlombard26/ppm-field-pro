# Customer report import: local checkpoint, original-file parsing checked

**Current status:** [Gallagher wiring mapping is implemented and verified against the originals](WIRING_IMPORT_REVIEW.md). The earlier dependency proposal and mapping notes below are retained for context; historical maintenance import remains a separate unresolved scope.

The separate importer follow-on now includes conservative XLS/XLSX configuration import and PDF text preview in both entry points. See [implementation and verification limits](IMPORTER_REVIEW.md). No supplied customer content was copied into this repository or its tests. The original generic input appender remains a separate legacy path.

## Approved local dependencies

Browser-local processing is technically feasible for the described selectable-text PDFs and Excel workbook. It need not upload source files to a service. The parser does not itself resolve conflicting identities or interpret maintenance evidence; that requires application logic and a review UI.

The user approved these two pinned, local/vendored distributions. Licenses and hashes are recorded in `vendor/PARSER-PROVENANCE.json`:

1. **Mozilla PDF.js / `pdfjs-dist` 6.4.299**: `pdf.mjs` plus its matching `pdf.worker.mjs` and required distribution support assets. Use the text-content API with text positions/page context; no OCR or native canvas package is required for a browser text-only extraction path. Do not mix worker/library versions. Browser compatibility must be tested before adopting this pin. Official getting-started page currently links this stable release and documents the two modules: https://mozilla.github.io/pdf.js/getting_started/ . Official package source: https://github.com/mozilla/pdfjs-dist .
2. **SheetJS Community Edition 0.20.3**, full standalone `xlsx.full.min.js` distribution (includes older XLS support): https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js . Official documentation identifies this version and authoritative distribution: https://docs.sheetjs.com/docs/getting-started/installation/standalone/ . The current app dynamically requests old SheetJS 0.18.5 from jsDelivr; a reviewed local pin should replace that dependency in the importer phase rather than silently installing a second runtime.

These approved parsers were downloaded from their official sources, integrity checked and exercised against synthetic files. The matching PDF.js legacy library/worker are vendored for compatibility. This is not a complete third-party source audit or browser compatibility claim. Avoid an additional `pdf-parse`, OCR engine, Python PDF toolchain or spreadsheet package unless evidence shows a need. Host the app through HTTP(S), not file://, for PDF worker use. Bundled local assets permit parsing without external content requests once the app is available; true offline app startup remains a separate existing PWA gate.

## Mapping contract from read-only attachment inspection

- Both PDFs are Gallagher Wiring Reports, including the one named Contact ID Report. They do not provide an actual Contact ID reporting-number table. Missing reporting codes stay unset.
- Keep controller, HBUS module, input, output, door, lift and relationship entities distinct. Preserve parent-controller context across pages and wrapped cells. Module label/number, bus, device address, terminal, serial and reporting code are different concepts; never infer a device address from a label suffix.
- Workbook tabs include site/cover data, asset register, head-end/configuration data, checklist/assessment results, power/batteries, summaries, electric fence and equipment evidence. Configuration and historical inspection data require separate target collections/dated visits.
- Flag conflicting MACs, totals, dates, scopes and repeated identifiers. Reject or explicitly exclude a foreign-site template tab. Do not import passwords/installer codes, infer physical lock make/model from configured behavior, or mark fresh visits passed.
- Preview mapped fields, source filename/page/sheet/row/date, confidence, original source text and unresolved relationships before an explicit save. Keep source material local and out of repository fixtures. Identity keys must include stable explicit context; ambiguous matches require a conflict choice. Repeat imports must be idempotent and never overwrite inspection history automatically.

Synthetic acceptance example: Demo FTC #01 Controller 6000, 8H plugin; HBUS I/O module label 2, 16-in/16-out, serial DEMO-0002, bus 1; input IN7, Demo Store PIR. Door Remote Release refers to module device address 11 and PCB Input 7. Preserve module label 2, device address 11 and terminal 7 separately; reporting code remains unset. Include tests for page continuation, wrapped cells, duplicate imports, divergent snapshots and excluded site scope.

## Next deliverable

### Additional Integriti BIFF8 examples

The three newly inspected Integriti reports are Excel 97–2003 **BIFF8 `.xls`**, not XLSX. The full SheetJS distribution above is vendored specifically to cover both formats. Print-report sheets contain titles, merged spacer columns, repeated headers and footers. Detect header labels rather than assuming row 4; retain actual cell positions.

- Controller listing: type, site, name, controller type, serial, state, last modified/by, notes.
- Door listing: entity type, controller/site, ID/name, modified/by, software class labelled manufacturer, door type, inside/outside areas, status, notes. `IntegritiDoor` is not a physical manufacturer. There is no explicit reader relationship; do not infer one from matching numeric suffixes.
- LAN module listing: type, controller/site, ID/name, modified/by, serial, firmware, status/extended status, notes. Preserve C/T/E/R-prefixed IDs as text and scope identity by site + controller + ID. Blank/zero serials are not identity keys. Control-module rows that explicitly match controller serials represent the same physical controller and must be proposed as links, not counted as new controllers.
- Excel 1900 date/time values are configuration modification timestamps without an asserted timezone. Status is a configuration snapshot, not a performed inspection result. These reports contain no input list, Contact ID codes, physical make/model, photos or maintenance tests. Do not fill those fields by inference.

After explicit dependency approval: isolate parsing in workers, bound file sizes/pages/rows, build pure semantic mappings using synthetic fixtures, present a review/dedup/conflict screen, then atomically persist approved records through the existing site revision mechanism. Verify on actual Android and desktop browsers before claiming onsite readiness.
