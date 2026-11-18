import type {
  DownloadItem,
  Event,
  InputEvent,
  Session,
  WebContents,
} from 'electron';

export const USER_ACTIVATION_WINDOW_MS = 5_000;
export const NEW_WINDOW_DOWNLOAD_HANDOFF_TTL_MS = 10_000;

const USER_ACTIVATION_INPUT_TYPES = new Set<InputEvent['type']>([
  'mouseDown',
  'mouseUp',
  'rawKeyDown',
  'keyDown',
  'char',
  'gestureTap',
  'gestureShortPress',
  'gestureLongPress',
  'touchEnd',
  'pointerDown',
  'pointerUp',
]);

type IPendingDownloadHandoff = {
  url: string;
  sourceWebContentsId: number;
  expiresAt: number;
};

export type IDownloadItemLike = Pick<
  DownloadItem,
  'getURL' | 'hasUserGesture'
> &
  Partial<Pick<DownloadItem, 'getURLChain'>>;

export type IWebContentsIdLike = Pick<WebContents, 'id'> | null | undefined;

export function normalizeDownloadHandoffUrl(
  rawUrl: string | undefined,
): string {
  if (!rawUrl) {
    return '';
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    return parsed.href;
  } catch {
    return '';
  }
}

export class WebviewDownloadPolicy {
  private readonly lastUserActivationByContentsId = new Map<number, number>();

  private readonly pendingHandoffs: IPendingDownloadHandoff[] = [];

  recordInputEvent(
    webContentsId: number,
    inputEvent: Pick<InputEvent, 'type'> | null | undefined,
    now = Date.now(),
  ): boolean {
    if (!inputEvent || !USER_ACTIVATION_INPUT_TYPES.has(inputEvent.type)) {
      return false;
    }
    this.lastUserActivationByContentsId.set(webContentsId, now);
    return true;
  }

  clearWebContents(webContentsId: number): void {
    this.lastUserActivationByContentsId.delete(webContentsId);
  }

  recordNewWindowHandoff({
    sourceWebContentsId,
    url,
    now = Date.now(),
  }: {
    sourceWebContentsId: number;
    url: string | undefined;
    now?: number;
  }): boolean {
    this.pruneExpired(now);
    const activatedAt =
      this.lastUserActivationByContentsId.get(sourceWebContentsId);
    if (
      activatedAt === undefined ||
      now - activatedAt > USER_ACTIVATION_WINDOW_MS
    ) {
      this.lastUserActivationByContentsId.delete(sourceWebContentsId);
      return false;
    }
    this.lastUserActivationByContentsId.delete(sourceWebContentsId);
    const normalizedUrl = normalizeDownloadHandoffUrl(url);
    if (!normalizedUrl) {
      return false;
    }
    this.pendingHandoffs.push({
      url: normalizedUrl,
      sourceWebContentsId,
      expiresAt: now + NEW_WINDOW_DOWNLOAD_HANDOFF_TTL_MS,
    });
    return true;
  }

  shouldAllowDownload({
    item,
    webContents,
    now = Date.now(),
  }: {
    item: IDownloadItemLike;
    webContents?: IWebContentsIdLike;
    now?: number;
  }): boolean {
    this.pruneExpired(now);
    if (item.hasUserGesture()) {
      return true;
    }
    if (typeof webContents?.id !== 'number') {
      return false;
    }
    const urlChain =
      typeof item.getURLChain === 'function' ? item.getURLChain() : [];
    const initialUrl = normalizeDownloadHandoffUrl(urlChain[0] || item.getURL());
    if (!initialUrl) {
      return false;
    }
    const matchIndex = this.pendingHandoffs.findIndex(
      (entry) =>
        entry.url === initialUrl &&
        entry.sourceWebContentsId !== webContents.id,
    );
    if (matchIndex === -1) {
      return false;
    }
    this.pendingHandoffs.splice(matchIndex, 1);
    return true;
  }

  private pruneExpired(now: number): void {
    for (const [
      id,
      activatedAt,
    ] of this.lastUserActivationByContentsId.entries()) {
      if (now - activatedAt > USER_ACTIVATION_WINDOW_MS) {
        this.lastUserActivationByContentsId.delete(id);
      }
    }
    for (let i = this.pendingHandoffs.length - 1; i >= 0; i -= 1) {
      if (this.pendingHandoffs[i].expiresAt <= now) {
        this.pendingHandoffs.splice(i, 1);
      }
    }
  }
}

export type IOverlaySessionLike = Pick<
  Session,
  | 'setPermissionCheckHandler'
  | 'setPermissionRequestHandler'
  | 'setDevicePermissionHandler'
  | 'removeAllListeners'
  | 'on'
>;

export type IWebviewSessionDownloadTarget = Pick<
  Session,
  'setDevicePermissionHandler' | 'removeAllListeners' | 'on'
>;

export function configureOverlaySessionPermissions(
  overlaySession: IOverlaySessionLike,
): void {
  overlaySession.setPermissionCheckHandler(() => false);
  overlaySession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );
  overlaySession.setDevicePermissionHandler(() => false);
  // Block all file downloads initiated from untrusted notification/deeplink
  // overlay pages to prevent drive-by downloads. Clear prior listeners first
  // so MAS soft restarts do not stack duplicate handlers on the persistent session.
  overlaySession.removeAllListeners('will-download');
  overlaySession.on('will-download', (event: Event) => {
    event.preventDefault();
  });
}

export function configureWebviewSessionDeviceAndDownloadPolicy({
  webviewSession,
  downloadPolicy,
  onAutomaticDownloadBlocked,
}: {
  webviewSession: IWebviewSessionDownloadTarget;
  downloadPolicy: WebviewDownloadPolicy;
  onAutomaticDownloadBlocked?: () => void;
}): void {
  // Deny direct WebUSB / WebHID / WebSerial device access from DApp webviews
  // so pages cannot bypass background hardware-wallet services.
  webviewSession.setDevicePermissionHandler(() => false);
  // Block automatic (drive-by) downloads that lack an explicit user gesture
  // or a user-activated new-window handoff.
  webviewSession.removeAllListeners('will-download');
  webviewSession.on(
    'will-download',
    (event: Event, item: DownloadItem, webContents: WebContents) => {
      if (!downloadPolicy.shouldAllowDownload({ item, webContents })) {
        event.preventDefault();
        onAutomaticDownloadBlocked?.();
      }
    },
  );
}
