# Gallagher wiring importer: local implementation review

Follow-on to `3b30543b23ab4a9eae736a0ec372d5e8bafeb06d` on `feat/h3c-qld-2202-input-modules-asset-photos`. Retains the core feature commit and draft PR13 base `0b7384fde34373c86492b0761d025c08a6810d03`. No remote Git writes, production imports, SQL or deployment.

## Behavior

Both entry points now send recognized Gallagher Wiring PDFs through the same configuration preview, selected-row confirmation and permission-checked apply path as Excel reports. Unrecognized PDFs remain text review only. A filename is never used to infer reporting codes.

The new pure coordinate mapper groups pages by explicit Site Name/Type/Name headers. It retains entity/section/column context for continued tables, joins wrapped values inside their column and row bounds, and uses neighboring metadata labels to read wrapped entity names. Missing headers or unsupported types produce explicit warnings; no rows are guessed from loose text order. It creates controller, HBUS module, input, output, reader, door and lift configuration records. It preserves source page/section/row, explicit controller and parent keys, PCB labels, terminal numbers, module variants and serials. Controller bus discovery lists supply exact scoped name/bus associations. Bus, module name/number, device address, PCB terminal and Contact ID reporting code remain distinct. No module number or reporting code is invented from a name suffix.

Door/lift wiring functions retain connected-device text, the original address and PCB label. Only a unique controller with matching compact wrapped name and a valid matching MAC address receives a proven endpoint reference. Numeric module endpoints remain unresolved when the source does not prove a module/address association. Lift floor/access-zone/input/output names and reader associations remain separate configuration structures. These nested structures are visible in preview; they do not create maintenance results.

Apply resolves available parent/controller/endpoint IDs only within the selected site. Unselected or unavailable dependencies remain flagged; the preview instructs users to select controller/module dependencies too. Existing records are never overwritten. Identical imports skip existing identities, duplicate identities all block, and changed wiring snapshots or local edits block with changed field names shown. Source differences require explicit future reconciliation, not an automatic merge. Applying does not mutate the preview or prior records/photos/visits.

## Original-file checks

The six originals were opened read-only from the exact user-authorized local folder. No original or extracted customer record was copied into Git, fixtures or artifacts. Artifacts retain aggregate counts only.

The short PDF yields 3 controllers, 5 modules, 74 inputs, 30 outputs and 1 reader (113 records). The longer PDF yields the same records plus 11 doors and 1 lift (125 records). Combining them adds only the 12 new entities; repeat import adds zero. All five modules acquire explicit bus associations; all created input/output/reader parents and controller links resolve. The longer report retains 38 door/lift wiring connections: 31 proven controller endpoints and 7 unresolved numeric endpoints, plus 5 lift-floor rows and 1 lift reader association. These counts were asserted against independently established source counts; parser behavior contains no customer-specific counts or identifiers.

The workbook now distinguishes 14 apparent category headings (type/location only), 11 location-only template/separator rows, and 65 genuine potential assets without usable identity. The first two categories remain explicit per-row warnings rather than invented assets. The 65 potential assets now appear as blocked preview records with their mapped fields visible. Total asset-list preview: 148 candidates, 77 addable and 71 blocked (65 missing identities plus 6 duplicate-identity rows). Seven non-asset worksheets remain excluded. The three Integriti listings retain their prior verified 187-asset combined result and five controller links.

## Tests and manual review

Final combined automated suite: **168 passed, 0 failed, 0 skipped** (132 core checks and 36 importer checks). Original PDF assertions also passed separately, including exact counts, repeat imports, resolved/unresolved links, and unchanged original bytes. Evidence: `wiring-full-suite.tap`, `wiring-original-checks.json`, and `wiring-workbook-checks.json` beside the review artifacts.

Synthetic regressions cover page continuation with retained columns, wrapped entity/cell values, distinct bus/address/terminal meanings, missing columns, duplicate identities, conflicting snapshots, selected dependencies, immutable preview/history, secret-looking mapped values, lift tables, workbook row classifications and the shared PDF confirmation flow. The real PDF.js/SheetJS tests and all PR13/core regression tests remain included in `npm test`. Node PDF.js text parsing still warns that optional native rendering components are absent; no rendering package was installed.

Manual review covered new mapping/identity logic, worker integration, loader cache versions, escaped preview text, confirmed apply, account/role/site/stale-state guards, existing quota-atomic storage, source-value limits and relationship scoping. Secret-looking mapped fields block; free-text descriptions and unsupported properties are not imported. Provenance stores configuration context, not original PDF content. Existing 15 MiB file / 100 PDF pages / one-million-character / 2,000-candidate / worker deadline protections remain in force, with 2,000-character mapped field/cell limits. The vendored parser distribution is unchanged and was previously verified against 203 source hashes. This is a manual review, not a formal security scan or an exhaustive audit of third-party parser code.

## Remaining gates and scope limits

- Seven numeric wiring endpoints need explicit address-to-module evidence or manual reconciliation; suffix guessing would be unsafe.
- Workbook missing identities, incomplete potential assets and duplicate keys need user reconciliation. Category-heading classification is deliberately labeled apparent and retains source row references.
- Historical assessments require a separate mapping contract for source date/locale, technician, performed test, measured value, fault/risk/action and evidence attribution to a dated visit. Some template rows and sections have different scopes. Current authorization and schema mapping do not justify turning configuration status into a passed inspection or inventing signoff. No history import is implemented here.
- Real browser Worker loading, Android-PC behavior, offline startup, live Supabase/RLS/storage and true concurrent sessions remain untested. LinkeDOM/Node checks do not close these release gates.
- The formal Security Diff Scan workflow remains unavailable because its required preflight resource/API could not be accessed. No formal scan pass is claimed.
