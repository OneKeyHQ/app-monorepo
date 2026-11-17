import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

// Set by the app's WebView host, never by a page: any frame (a dApp's
// `data:` iframe included) can report the web-embed's opaque origin "null".
const WEB_EMBED_CHANNEL_PAYLOAD_KEY = '$onekeyWebEmbedChannel';

type IWebEmbedChannelPayload = IJsBridgeMessagePayload & {
  [WEB_EMBED_CHANNEL_PAYLOAD_KEY]?: boolean;
};

/**
 * Stamp (or clear) the web-embed channel mark on a page message before it
 * goes to the background. Payload fields other than origin/internal come from
 * the page, so a mark the page sent itself is always dropped.
 */
export function markWebEmbedChannelPayload(
  payload: IJsBridgeMessagePayload,
  isWebEmbedChannel: boolean,
): IJsBridgeMessagePayload {
  if (isWebEmbedChannel) {
    const marked: IWebEmbedChannelPayload = {
      ...payload,
      [WEB_EMBED_CHANNEL_PAYLOAD_KEY]: true,
    };
    return marked;
  }
  if (!(WEB_EMBED_CHANNEL_PAYLOAD_KEY in payload)) {
    return payload;
  }
  const { [WEB_EMBED_CHANNEL_PAYLOAD_KEY]: _forged, ...rest } =
    payload as IWebEmbedChannelPayload;
  return rest;
}

export function hasWebEmbedChannelMark(payload?: IJsBridgeMessagePayload) {
  return (
    (payload as IWebEmbedChannelPayload | undefined)?.[
      WEB_EMBED_CHANNEL_PAYLOAD_KEY
    ] === true
  );
}
