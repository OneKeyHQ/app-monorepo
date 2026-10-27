/**
 * Single entry point for writing `document.title`, scoped to the web build.
 *
 * Only on web does the document title belong to the app: it is the browser tab
 * label. Everywhere else the same title is owned by the shell around the
 * renderer, and overwriting it leaks in-app state into the OS:
 *   - desktop: Electron mirrors the page title onto the native window, so it
 *     shows up in the Dock window list, the Window menu, Mission Control and
 *     window pickers while screen sharing.
 *   - extension: it becomes the popup / expanded-tab title.
 *   - native: there is no `document` at all.
 *
 * Those targets keep the static "OneKey" title that ships in the HTML shell
 * (`packages/shared/src/web/index.html`), so every call here is a no-op.
 */

import platformEnv from '../platformEnv';

function canWriteDocumentTitle(): boolean {
  return (
    platformEnv.isWeb === true && typeof globalThis.document !== 'undefined'
  );
}

export function getDocumentTitle(): string {
  if (!canWriteDocumentTitle()) {
    return '';
  }
  return globalThis.document.title;
}

export function setDocumentTitle(title: string): void {
  if (!canWriteDocumentTitle()) {
    return;
  }
  globalThis.document.title = title;
}
