This macOS test compiles the installed `RNCOneKeyWebEmbedAssets` Objective-C source and runs it in an isolated, disposable UIKit app with a nonpersistent `WKWebView`. It copies the supplied protected WebEmbed candidate without modifying its HTML, SRI, CSP, or JavaScript files. All file-access preferences remain at WebKit defaults; the public scheme has no CORS relaxation or network proxy. A fixture-only content rule blocks external traffic.

```sh
python3 apps/mobile/scripts/native-tests/web-embed-scheme/run.py \
  --artifact path/to/protected-web-embed \
  --output path/to/new-native-test-report
```

The runner requires macOS, Xcode, and an installed iOS simulator runtime. By default it creates and deletes a dedicated simulator. `--runtime` selects an installed runtime. For coordinated local work, `--simulator UUID` may reuse an explicitly selected simulator whose name starts with `OneKey LavaMoat`; this does not stop or delete the borrowed simulator. A unique test bundle ID prevents access to existing application data. The runner removes its test app and records cleanup results. It fails on missing prerequisites, a timeout, failed assertions, or incomplete cleanup.

The tests cover canonical source and resource URLs; GET-only access; query, credentials, encoded-authority, traversal and symlink rejection; cancellation before and during task callbacks; real main-frame and same-origin/opaque iframe message metadata; rejected external/file/content navigation; document hash routes; original SRI rejection of a deliberately corrupted runtime **response**; successful restoration; and an ordinary HTML view without lockdown. Reports include the input file hashes, native source hashes, assertion results, native frame provenance, and live-view screenshots. They contain only public fixture data.

The lifecycle fixture compiles selected method bodies directly from the installed `RNCWebViewImpl.m` and the unconditional Fabric property assignment from `RNCWebView.mm`. This checks locked flag transitions, destruction, stale generations, and equal-prop recycling against the production source, including recovery to an ordinary view only after destruction. It does not emulate React, its event dispatcher, or the complete native view lifecycle.

A document URL may contain a hash route after the fixed `index.html`; resource requests must have neither fragments nor queries. The iframe provenance cases deliberately permit iframe creation in the fixture so that the production message guard receives genuine WebKit metadata. A separate navigation case applies the production navigation predicate and rejects child-frame navigation.

These checks do not replace the complete OneKey Release build and bridge handshake in its two Hermes runtimes. Native `main` owns the WebView; `bg` and `main` exchange bridge messages while retaining separate JS heaps. WebKit uses a further independent JS heap. They share native resources and packaged bytes, not JavaScript objects. The runner validates a supplied candidate and must not be used as evidence that an unapproved candidate passed the production artifact or browser-compatibility gates.
