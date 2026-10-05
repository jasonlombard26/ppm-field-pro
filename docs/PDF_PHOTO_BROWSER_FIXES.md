# PDF worker protocol and photo confirmation follow-on

Base `120e55293402723f72ef9146d4a929b0779cccf3`. Read the separate task-3 Chrome evidence and isolation scripts; did not edit its fixture, run its browser, change permissions or start its server. This is a local implementation follow-on, not a deployment.

## PDF diagnosis and change

The Chrome failure's exact alert text was not captured. The fixture serves `.mjs` as JavaScript and its CSP permits same-origin script/worker loading; static inspection found no direct restriction explaining the generic PDF failure. No CSP or security setting was relaxed.

A concrete application protocol defect was reproduced with the unchanged vendored PDF.js worker in a browser-style Node VM realm: absent Node globals, the module initializes a worker message handler and posts `{action:'ready', sourceName:'worker', targetName:'main'}` to its enclosing channel. PDF.js's API also refers to `window.location` when it creates a worker; inside our existing parser worker that path falls back to importing the PDF worker in the same realm. Our UI treated any message on that channel as its parse result, terminating the worker and rejecting the unrecognized message. Node's different PDF.js path masked the issue. This defect is consistent with the observed Chrome failure; because the exact alert was unavailable, it is not claimed to exclude all other browser-specific failures.

The browser parser now supplies PDF.js an explicit, separate module-worker port. PDF.js data-fetching remains in that worker, using same-origin vendored font/cmap/wasm assets rather than document-dependent factories. The application protocol has a `ppm-report-result` marker; the UI ignores unrelated internal messages. Both PDF worker and port are released on success or document-load failure; the existing outer worker timeout remains. Node text parsing keeps its existing supported path. Vendor files and parser versions are unchanged.

## Photo deletion change

QA established that a native confirmation appeared, then browser control stalled; it did not establish whether deletion succeeded or whether the app was at fault. The native confirmation was replaced with an in-app alert dialog: explicit Cancel/Delete buttons, Cancel initial focus, Escape cancellation, focus containment/return, labeled dialog/description and inline errors. Labels are inserted as text. Confirmation remains mandatory.

Delete rechecks editable role, owner/generation, current photo identity and upload activity after confirmation and across asynchronous cloud operations. Cloud deletion still requires cloud access and verifies that the object is gone. Repeated confirmation cannot issue a second removal. Local state is persisted before its in-memory photo list is changed, so a local quota failure retains the record. A cloud-success/local-save failure is reported accurately. Successful deletion refreshes gallery content and site counts while retaining unrelated attachments. The implementation/tests use synthetic photos only; no customer photo was deleted.

## Verification and required browser retest

Final combined automated suite: **182 passed, 0 failed, 0 skipped**. Coverage adds vendor ready-message reproduction in a browser-style VM; explicit child-port and success/failure cleanup checks with a controlled PDF API; application filtering of unrelated messages; Cancel/Escape; label escaping; role/generation/upload/quota changes; repeated delete; gallery refresh; and existing all-category local/cloud removal tests. These remain Node/VM/LinkeDOM tests, not a real browser proof. The VM test uses an existing Node flag and installs no software.

Owning QA task should rebuild its isolated snapshot from the new commit and test:

1. Generic synthetic PDF reaches PDF Text Review without adding assets; closing changes nothing.
2. Synthetic wiring PDF reaches configuration preview, explicit selected apply and repeat-import handling. Check worker/font/cmap requests and console errors if either PDF path fails; preserve the exact error text.
3. Synthetic photo Delete opens the in-app dialog. Cancel and Escape retain it; explicit Delete removes only that photo, updates count/gallery and survives reload. No native confirm should appear.
4. Preserve the already verified UI layout/input/XLS/XLSX flows. Do not use real customer data or cloud accounts.

Actual Chrome verification of these new changes remains pending. Live Storage/RLS, Android hardware, cross-device concurrency, full offline deployment and formal security scanning remain open gates. No push, remote Git change or deployment occurred.
