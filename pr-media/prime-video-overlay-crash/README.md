# PR media: iOS Prime feature-intro video dialog close crash

Screen recordings captured on an iOS 27.0 Simulator (iPhone 18 Pro Max) from the
`fix/prime-video-overlay-crash` branch.

- `before.gif` / `before.mp4` — pre-fix build: open the Prime feature-intro dialog, let the intro
  video play, close it → the app aborts with `UIViewControllerHierarchyInconsistency`
  (SIGABRT). The recording ends on the SpringBoard because the process was terminated.
- `after.gif` / `after.mp4` — fixed build: same flow (dialog opens, video plays, close) → the
  sheet dismisses back to Home and the app stays alive; a second open/close cycle follows.
- `before-crash-stack.txt` — the exact native exception and UIKit frames captured from the
  simulator console during the `before` recording.

The dialog is driven programmatically (a temporary dev-only harness, not committed) because
simulator touch injection is unavailable in this environment; the user flow and close action are
the same as the reported repro (`prime-feature-intro-close`).
