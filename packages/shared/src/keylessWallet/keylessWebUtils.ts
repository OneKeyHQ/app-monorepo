import { KEYLESS_WEB_TAB_URL_PATTERNS } from './keylessWebTabUrlPatternsConstants';
import {
  type IKeylessWebConnectAlertMessage,
  type IKeylessWebOpenSidePanelMessage,
  KEYLESS_WEB_CONNECT_ALERT_MESSAGE_TYPE,
  KEYLESS_WEB_OPEN_SIDE_PANEL_MESSAGE_TYPE,
} from './keylessWebTypes';

export function isKeylessWebConnectAlertMessage(
  payload: unknown,
): payload is IKeylessWebConnectAlertMessage {
  const message = payload as
    | Partial<IKeylessWebConnectAlertMessage>
    | undefined;
  return (
    message?.type === KEYLESS_WEB_CONNECT_ALERT_MESSAGE_TYPE &&
    typeof message.message === 'string'
  );
}

export function isKeylessWebOpenSidePanelMessage(
  payload: unknown,
): payload is IKeylessWebOpenSidePanelMessage {
  const message = payload as
    | Partial<IKeylessWebOpenSidePanelMessage>
    | undefined;
  return message?.type === KEYLESS_WEB_OPEN_SIDE_PANEL_MESSAGE_TYPE;
}

export function isKeylessWebAutoConnectOriginAllowed(
  input: URL | string | undefined,
): boolean {
  if (!input) {
    return false;
  }
  let url: URL | undefined;
  if (typeof input === 'string') {
    try {
      url = new URL(input);
    } catch {
      return false;
    }
  } else {
    url = input;
  }

  return KEYLESS_WEB_TAB_URL_PATTERNS.some((pattern) => {
    try {
      const patternUrl = new URL(pattern.replace(/\/\*$/, '/'));
      return (
        patternUrl.protocol === url.protocol &&
        patternUrl.hostname === url.hostname
      );
    } catch {
      return false;
    }
  });
}
