function connect({
  reconnect = false,
  name,
  onMessage,
  onConnect,
}: {
  reconnect?: boolean;
  name: string;
  onMessage: (payload: any) => void;
  onConnect: (port0: chrome.runtime.Port) => () => void;
}) {
  try {
    if (reconnect) {
      // noop
    }

    const port = chrome.runtime.connect({
      includeTlsChannelId: true,
      name,
    });

    if (chrome.runtime.lastError) {
      // NOT Working for port connect error
      debugger;
    }

    port.onMessage.addListener(onMessage);

    let cleanup: () => void;
    const onDisconnect = () => {
      // TODO re-connect to background
      port.onMessage.removeListener(onMessage);
      port.onDisconnect.removeListener(onDisconnect);
      if (cleanup) {
        cleanup();
      }
    };
    port.onDisconnect.addListener(onDisconnect);

    if (onConnect) {
      cleanup = onConnect(port);
    }

    return port;
  } catch (error) {
    // NOT Working for port connect error
    debugger;
    throw error;
  }
}

export default {
  connect,
};
