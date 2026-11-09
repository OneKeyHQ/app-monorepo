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

/**
 * Dedicated persistent partition for the isolated Prime checkout webview.
 *
 * The checkout webview renders the app shell itself with
 * `?render=prime-purchase` (apps/desktop/PrimePurchaseWebEmbedApp.tsx), so it
 * needs the same file:// app-shell resolution as the main window, but it must
 * not share cookies/localStorage/IndexedDB with the wallet's default session
 * or with DApp webviews. The main process registers the guarded app-shell file
 * protocol resolver on this session only.
 */
export const PRIME_PURCHASE_WEBVIEW_PARTITION = 'persist:onekey-prime-purchase';
