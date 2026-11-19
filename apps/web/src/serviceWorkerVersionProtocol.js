import {
  WEB_ROUTE_NOT_FOUND_EVENT,
  WEB_ROUTE_RECOVERED_EVENT,
} from '@onekeyhq/kit/src/routes/config/webDappUrlFallback';

const MESSAGE_TYPES = {
  GET_VERSION_STATE: 'GET_VERSION_STATE',
  CHECK_VERSION: 'CHECK_VERSION',
  ACTIVATE_VERSION: 'ACTIVATE_VERSION',
  REPORT_CLIENT_STATE: 'REPORT_CLIENT_STATE',
  VERSION_STATE: 'VERSION_STATE',
  UPDATE_READY: 'UPDATE_READY',
  UPDATE_FAILED: 'UPDATE_FAILED',
  VERSION_ACTIVATED: 'VERSION_ACTIVATED',
};
const AUTO_RELOAD_STORAGE_KEY = '__onekey_sw_error_auto_reload__';
const ACTIVATION_TIMEOUT_MS = 3000;

export function createServiceWorkerVersionProtocol({
  checkIntervalMs,
  getCurrentWebVersion,
  isPageInErrorState,
  showUpdateBanner,
}) {
  let pendingActivation;
  let deferredAutoReloadVersion = '';
  let nextActivationRequestId = 0;
  let isAutoReloading = false;
  let isListeningForVersionUpdates = false;
  let latestReadyVersion = '';
  let latestActiveVersion = '';

  function getAutoReloadTargetKey(version) {
    return `${version}:${globalThis.location.pathname || '/'}`;
  }

  function canAutoReload(version) {
    if (
      !version ||
      version === getCurrentWebVersion() ||
      !isPageInErrorState()
    ) {
      return false;
    }
    try {
      return (
        globalThis.sessionStorage?.getItem(AUTO_RELOAD_STORAGE_KEY) !==
        getAutoReloadTargetKey(version)
      );
    } catch {
      return true;
    }
  }

  function postMessage(type, payload = {}) {
    navigator.serviceWorker?.controller?.postMessage({
      type,
      payload: {
        clientVersion: getCurrentWebVersion(),
        clientAutoReloadCapable: true,
        hasPageError: isPageInErrorState(),
        ...payload,
      },
    });
  }

  function requestVersionCheck() {
    if (!isListeningForVersionUpdates || !navigator.serviceWorker?.controller) {
      return;
    }
    postMessage(MESSAGE_TYPES.GET_VERSION_STATE);
    postMessage(MESSAGE_TYPES.CHECK_VERSION);
  }

  function removeUpdateBanner() {
    document.getElementById('sw-update-banner')?.remove();
  }

  function reloadPageManually() {
    // A beforeunload prompt can leave the current document and banner in place.
    globalThis.location.reload();
  }

  function reloadPageAutomatically(version) {
    isAutoReloading = true;
    removeUpdateBanner();
    try {
      globalThis.sessionStorage?.setItem(
        AUTO_RELOAD_STORAGE_KEY,
        getAutoReloadTargetKey(version),
      );
    } catch {
      // Ignore sessionStorage restrictions in private/sandboxed contexts.
    }
    globalThis.location.reload();
  }

  function showManualUpdateBanner() {
    if (latestActiveVersion && latestActiveVersion !== getCurrentWebVersion()) {
      offerVersionUpdate(latestActiveVersion, true);
    } else if (latestReadyVersion) {
      offerVersionUpdate(latestReadyVersion, false);
    } else if (!pendingActivation && !isAutoReloading) {
      removeUpdateBanner();
    }
  }

  function finishActivation(activation) {
    if (pendingActivation !== activation) {
      return;
    }
    pendingActivation = undefined;
    deferredAutoReloadVersion = '';
    showManualUpdateBanner();
    reloadPageManually();
  }

  function cancelPendingActivation() {
    pendingActivation = undefined;
    const version = deferredAutoReloadVersion;
    deferredAutoReloadVersion = '';
    if (!isAutoReloading && canAutoReload(version)) {
      postMessage(MESSAGE_TYPES.CHECK_VERSION, {
        retryAutoReloadVersion: version,
      });
    }
  }

  function activateReadyVersion(version) {
    if (isAutoReloading || pendingActivation) {
      return;
    }
    nextActivationRequestId += 1;
    const activation = {
      version,
      requestId: nextActivationRequestId,
    };
    pendingActivation = activation;
    postMessage(MESSAGE_TYPES.ACTIVATE_VERSION, {
      version,
      requestId: activation.requestId,
    });
    setTimeout(() => finishActivation(activation), ACTIVATION_TIMEOUT_MS);
  }

  function requestRecoveryCheck() {
    if (!isPageInErrorState() || isAutoReloading || pendingActivation) {
      return;
    }
    requestVersionCheck();
  }

  function offerVersionUpdate(version, isActive) {
    if (isAutoReloading || pendingActivation) {
      return;
    }
    if (isActive) {
      showUpdateBanner(reloadPageManually);
    } else {
      showUpdateBanner(() => activateReadyVersion(version));
    }
  }

  function handleMessage(event) {
    const type = event.data?.type;
    const payload = event.data?.payload || {};

    if (type === MESSAGE_TYPES.UPDATE_READY && payload.version) {
      latestReadyVersion = payload.version;
      offerVersionUpdate(latestReadyVersion, false);
    }

    if (type === MESSAGE_TYPES.VERSION_STATE) {
      latestActiveVersion =
        typeof payload.activeVersion === 'string' ? payload.activeVersion : '';
      latestReadyVersion =
        typeof payload.readyVersion === 'string' ? payload.readyVersion : '';
      if (
        pendingActivation &&
        latestReadyVersion !== pendingActivation.version &&
        latestActiveVersion !== pendingActivation.version
      ) {
        cancelPendingActivation();
      }
      showManualUpdateBanner();
    }

    if (
      type === MESSAGE_TYPES.UPDATE_FAILED &&
      payload.operation === MESSAGE_TYPES.ACTIVATE_VERSION &&
      pendingActivation &&
      payload.version === pendingActivation.version &&
      payload.requestId === pendingActivation.requestId
    ) {
      cancelPendingActivation();
      if (latestReadyVersion === payload.version) {
        latestReadyVersion = '';
      }
      showManualUpdateBanner();
    }

    if (type === MESSAGE_TYPES.VERSION_ACTIVATED && payload.version) {
      const version = payload.version;
      latestActiveVersion = version;
      if (latestReadyVersion === version) {
        latestReadyVersion = '';
      }
      if (pendingActivation?.version === version) {
        finishActivation(pendingActivation);
      } else if (
        payload.autoReload === true &&
        !isAutoReloading &&
        canAutoReload(version)
      ) {
        if (!pendingActivation) {
          reloadPageAutomatically(version);
        } else if (deferredAutoReloadVersion !== version) {
          deferredAutoReloadVersion = version;
          // A directed reload does not report whether our manual target still exists.
          postMessage(MESSAGE_TYPES.GET_VERSION_STATE);
        }
      } else if (version !== getCurrentWebVersion()) {
        offerVersionUpdate(version, true);
      }
    }
  }

  function setup() {
    navigator.serviceWorker.addEventListener('message', handleMessage);
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      requestVersionCheck,
    );
    isListeningForVersionUpdates = true;
    requestVersionCheck();
    setInterval(requestVersionCheck, checkIntervalMs);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        requestVersionCheck();
      }
    });
  }

  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener(
      WEB_ROUTE_NOT_FOUND_EVENT,
      requestRecoveryCheck,
    );
    globalThis.addEventListener(WEB_ROUTE_RECOVERED_EVENT, () => {
      deferredAutoReloadVersion = '';
      postMessage(MESSAGE_TYPES.REPORT_CLIENT_STATE);
    });
  }

  return {
    isReloadPending: () => isAutoReloading,
    requestVersionCheck,
    setup,
    requestRecoveryCheck,
  };
}
