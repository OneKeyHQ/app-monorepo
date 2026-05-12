/**
 * Electron <webview> partition names shared between the desktop main process
 * and the renderer.
 *
 * The overlay route uses a dedicated partition so the main process can
 * recognize overlay webviews at `web-contents-created` time — before any
 * navigation event can fire — and apply the strict overlay URL policy in
 * `will-redirect` / `will-navigate` without a renderer-side registration
 * race. Using a non-`persist:` partition also gives overlay sessions
 * ephemeral cookies / storage, isolated from the wallet's shared session.
 */

export const DESKTOP_WEBVIEW_OVERLAY_PARTITION = 'onekey-overlay';
