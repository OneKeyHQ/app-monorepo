/**
 * Desktop <-> Extension Native Messaging host: shared constants & switches.
 *
 * This is the central context for the bridge that lets the browser extension
 * call the OneKey desktop app over Chrome Native Messaging (currently only to
 * use the desktop's OS-level `safeStorage` for owner-bound encrypt/decrypt).
 *
 * ============================================================================
 * STATUS: EXPERIMENTAL / EXPLORATORY — NOT production-ready.
 *   - DEV-ONLY (see the three gates below).
 *   - macOS only. MAS (Mac App Store) is NOT supported.
 *   - Several security risks are NOT yet covered (see "KNOWN SECURITY
 *     LIMITATIONS" below). The headline blocker is same-user host
 *     impersonation: it needs an authenticated E2EE channel before this can be
 *     formally released.
 * Do NOT remove the gates, widen the platform scope, or enable MAS without
 * completing the release checklist at the bottom of this comment.
 * ============================================================================
 *
 * Three independent gates keep this off in production. All three must flip to
 * enable it for real users:
 *   1. Extension permission `nativeMessaging` is added only when
 *      `process.env.NODE_ENV !== 'production'` (build-time) in
 *      apps/ext/src/manifest/chrome.js and chrome_v3.js.
 *   2. Desktop manifest/launcher install is skipped unless dev:
 *      `if (!isDesktopDevRuntime()) return` in
 *      apps/desktop/app/nativeMessagingHostInstall.ts.
 *   3. Desktop host refuses to serve unless dev:
 *      `if (!isDesktopDevRuntime()) app.exit(0)` in
 *      apps/desktop/app/nativeMessagingHost.ts.
 *
 * Dev detection: use `process.defaultApp` (true only for unpackaged
 * `electron <script>` runs), NOT `app.isPackaged` — OneKey's dev desktop
 * reports `app.isPackaged === true` even when unpackaged, so it is unreliable.
 *
 * Platform scope: macOS only during this exploratory stage. The install gate in
 * nativeMessagingHostInstall.ts is darwin-only; the Linux/Windows install paths
 * in that file are future scaffolding and are intentionally not reached yet.
 * MAS (Mac App Store) is NOT supported and is explicitly excluded
 * (`process.mas`) on top of the dev gate: the App Store sandbox forbids writing
 * to other browsers' config dirs and spawning child processes.
 *
 * ----------------------------------------------------------------------------
 * KNOWN SECURITY LIMITATIONS (unmitigated today — the reason this is dev-only)
 * ----------------------------------------------------------------------------
 * The threat is NOT a network MITM (Native Messaging is a stdin/stdout pipe,
 * there is no wire to tap). It is same-user local host impersonation/tampering:
 *   - The manifest (`<host>.json`) and launcher (`<host>.sh`) live in
 *     user-writable dirs. A same-user process can redirect the manifest `path`
 *     or rewrite the launcher to impersonate the desktop host.
 *   - Owner-binding does NOT defend against a hijacked host: `encryptString`
 *     sends PLAINTEXT to the host (a fake host reads it), and on `decryptString`
 *     a fake host can return attacker-chosen data.
 *   - Replay: the host is stateless. A challenge carries a ±5min timestamp and
 *     a nonce, but there is NO nonce cache, so a captured request can be
 *     replayed within the tolerance window.
 *   - Owner-binding only guarantees "a blob can only be decrypted by proving
 *     possession of the key that encrypted it" — it is data-at-rest binding,
 *     not transport/endpoint authentication.
 *
 * ----------------------------------------------------------------------------
 * LIFECYCLE / EDGE CASES still NOT handled (must be covered before release):
 * ----------------------------------------------------------------------------
 *   - Uninstall cleanup: uninstalling the desktop app does NOT remove the
 *     manifest (`<host>.json` in each browser's NativeMessagingHosts dir), the
 *     launcher (`<host>.sh` under userData), or the Windows registry keys. They
 *     are orphaned and the manifest keeps pointing at a deleted launcher/exe, so
 *     the extension call spawns a dead host and errors. macOS drag-to-trash runs
 *     NO uninstall hook, so these can linger indefinitely — need an explicit
 *     uninstall/cleanup path and/or extension-side self-heal.
 *   - Switch to the MAS build: after a non-MAS (notarized/dev) install, moving to
 *     the MAS (App Store) build leaves the old manifest/launcher behind, but the
 *     MAS sandbox CANNOT read/remove/rewrite them. The stale registration points
 *     at the removed non-MAS app -> a stuck broken state the MAS build cannot fix.
 *   - Stale path after move/update: the launcher bakes an absolute exe + entry
 *     path. Moving the app (e.g. Downloads -> Applications) or an update that
 *     changes paths leaves the launcher stale until the app next launches and
 *     rewrites it; a Chrome call before that re-launch hits the stale path.
 *   - Multiple installs/channels (stable + internal + dev) all share the same
 *     host name and overwrite each other's manifest -> last writer wins, so the
 *     "host" may be a different OneKey app than the extension expects.
 *
 * ----------------------------------------------------------------------------
 * BEFORE FORMAL RELEASE / PRODUCTION (do all of these first):
 * ----------------------------------------------------------------------------
 *   - Authenticated E2E channel: a desktop identity key anchored in the OS
 *     keychain (so a same-user binary cannot extract it) + that public key
 *     PINNED in the extension's signed code + per-session ECDH. This defeats
 *     host impersonation and the encrypt-plaintext exposure. Strongest on macOS
 *     (keychain ACL); weaker on Windows/Linux — account for that.
 *   - Replay protection: host-issued challenge or a nonce cache.
 *   - Cover the LIFECYCLE / EDGE CASES above (uninstall cleanup, MAS switch,
 *     stale paths after move/update, multi-channel manifest collisions).
 *   - Re-review before exposing ANY method beyond owner-bound safeStorage.
 */
import {
  ONEKEY_EXTENSION_ID_CHROME_PROD,
  ONEKEY_EXTENSION_ID_DEV,
  ONEKEY_EXTENSION_ID_EDGE_PROD,
} from './extensionIds';

export const ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_NAME =
  'so.onekey.wallet.desktop';

export const ONEKEY_DESKTOP_NATIVE_MESSAGING_HOST_ARG =
  '--onekey-native-messaging-host';

export const ONEKEY_DESKTOP_NATIVE_MESSAGING_EXTENSION_IDS_ENV =
  'ONEKEY_NATIVE_MESSAGING_EXTENSION_IDS';

export const ONEKEY_DESKTOP_NATIVE_MESSAGING_PROD_EXTENSION_IDS = [
  ONEKEY_EXTENSION_ID_CHROME_PROD,
  ONEKEY_EXTENSION_ID_EDGE_PROD,
] as const;

export const ONEKEY_DESKTOP_NATIVE_MESSAGING_DEV_EXTENSION_IDS = [
  ONEKEY_EXTENSION_ID_DEV,
] as const;

export const ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_PREFIX =
  'onekey-desktop-safe-storage:v1:';

export const ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_PURPOSE_EXTENSION_DATA =
  'onekey-extension-data';

export const ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_ALLOWED_PURPOSES = [
  ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_PURPOSE_EXTENSION_DATA,
] as const;

// Chrome caps a single Native Messaging message from the host to the extension
// at 1MB. The encrypt response is the hex-encoded (≈2x) safeStorage ciphertext
// of the envelope, so cap the plaintext value well below half of that budget to
// keep the response within the limit even after envelope + JSON overhead.
// safeStorage payloads are small secrets, so 256KB is generous in practice.
export const ONEKEY_DESKTOP_NATIVE_MESSAGING_SAFE_STORAGE_MAX_VALUE_BYTES =
  256 * 1024;

const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
const EXTENSION_ORIGIN_PATTERN = /^chrome-extension:\/\/([a-p]{32})\/?$/;

// Parse the ONEKEY_NATIVE_MESSAGING_EXTENSION_IDS env value into validated
// extension IDs. Only well-formed [a-p]{32} tokens survive, so callers can rely
// on the result containing no shell/path metacharacters or other garbage.
export function parseDesktopNativeMessagingEnvExtensionIds(
  envExtensionIds: string | undefined,
): string[] {
  if (!envExtensionIds) {
    return [];
  }
  return envExtensionIds
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter((id) => EXTENSION_ID_PATTERN.test(id));
}

export function getDesktopNativeMessagingAllowedExtensionIds(params: {
  includeDevExtensionIds: boolean;
  envExtensionIds?: string;
}): string[] {
  const allowedExtensionIds = new Set<string>();

  ONEKEY_DESKTOP_NATIVE_MESSAGING_PROD_EXTENSION_IDS.forEach((id) =>
    allowedExtensionIds.add(id),
  );

  if (params.includeDevExtensionIds) {
    ONEKEY_DESKTOP_NATIVE_MESSAGING_DEV_EXTENSION_IDS.forEach((id) =>
      allowedExtensionIds.add(id),
    );

    parseDesktopNativeMessagingEnvExtensionIds(params.envExtensionIds).forEach(
      (id) => allowedExtensionIds.add(id),
    );
  }

  return [...allowedExtensionIds];
}

export function parseDesktopNativeMessagingExtensionOrigin(
  origin: string | undefined,
): string | undefined {
  if (!origin) {
    return undefined;
  }
  const match = EXTENSION_ORIGIN_PATTERN.exec(origin);
  return match?.[1];
}
