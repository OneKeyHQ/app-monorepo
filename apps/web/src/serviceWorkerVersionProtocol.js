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
  let nextActivationRequestId = 0;
  let isReloading = false;
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
    if (!navigator.serviceWorker?.controller) {
      return;
    }
    postMessage(MESSAGE_TYPES.GET_VERSION_STATE);
    postMessage(MESSAGE_TYPES.CHECK_VERSION);
  }

  function removeUpdateBanner() {
    document.getElementById('sw-update-banner')?.remove();
  }

  function reloadPage(autoReloadedVersion) {
    if (isReloading) {
      return;
    }
    isReloading = true;
    removeUpdateBanner();
    if (autoReloadedVersion) {
      try {
        globalThis.sessionStorage?.setItem(
          AUTO_RELOAD_STORAGE_KEY,
          getAutoReloadTargetKey(autoReloadedVersion),
        );
      } catch {
        // Ignore sessionStorage restrictions in private/sandboxed contexts.
      }
    }
    globalThis.location.reload();
  }

  function showManualUpdateBanner() {
    if (latestActiveVersion && latestActiveVersion !== getCurrentWebVersion()) {
      showUpdateBanner(() => reloadPage());
    } else if (latestReadyVersion) {
      const version = latestReadyVersion;
      showUpdateBanner(() => activateReadyVersion(version, 'manual'));
    } else {
      removeUpdateBanner();
    }
  }

  function finishActivation(activation, confirmed) {
    if (pendingActivation !== activation) {
      return;
    }
    pendingActivation = undefined;
    if (activation.intent === 'manual') {
      reloadPage();
    } else if (canAutoReload(activation.version)) {
      // The fallback may still load the old version if promotion has not finished.
      reloadPage(confirmed ? activation.version : undefined);
    } else {
      showManualUpdateBanner();
    }
  }

  function activateReadyVersion(version, intent) {
    if (isReloading || pendingActivation?.intent === 'manual') {
      return;
    }
    nextActivationRequestId += 1;
    const activation = {
      version,
      intent,
      requestId: nextActivationRequestId,
    };
    pendingActivation = activation;
    if (intent === 'automatic') {
      removeUpdateBanner();
    }
    postMessage(MESSAGE_TYPES.ACTIVATE_VERSION, {
      version,
      requestId: activation.requestId,
    });
    setTimeout(
      () => finishActivation(activation, false),
      ACTIVATION_TIMEOUT_MS,
    );
  }

  function tryAutoReloadOnPageError() {
    if (!isPageInErrorState() || isReloading || pendingActivation) {
      return;
    }
    if (canAutoReload(latestActiveVersion)) {
      reloadPage(latestActiveVersion);
    } else if (canAutoReload(latestReadyVersion)) {
      activateReadyVersion(latestReadyVersion, 'automatic');
    } else if (
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      requestVersionCheck();
    }
  }

  function offerVersionUpdate(version, isActive) {
    if (isReloading || pendingActivation) {
      return;
    }
    if (canAutoReload(version)) {
      if (isActive) {
        reloadPage(version);
      } else {
        activateReadyVersion(version, 'automatic');
      }
    } else if (isActive) {
      showUpdateBanner(() => reloadPage());
    } else {
      showUpdateBanner(() => activateReadyVersion(version, 'manual'));
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
        pendingActivation = undefined;
      }
      if (
        latestActiveVersion &&
        latestActiveVersion !== getCurrentWebVersion()
      ) {
        offerVersionUpdate(latestActiveVersion, true);
      } else if (latestReadyVersion) {
        offerVersionUpdate(latestReadyVersion, false);
      } else if (!pendingActivation && !isReloading) {
        removeUpdateBanner();
      }
    }

    if (
      type === MESSAGE_TYPES.UPDATE_FAILED &&
      payload.operation === MESSAGE_TYPES.ACTIVATE_VERSION &&
      pendingActivation &&
      payload.version === pendingActivation.version &&
      payload.requestId === pendingActivation.requestId
    ) {
      pendingActivation = undefined;
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
        finishActivation(pendingActivation, true);
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
      tryAutoReloadOnPageError,
    );
    globalThis.addEventListener(WEB_ROUTE_RECOVERED_EVENT, () => {
      postMessage(MESSAGE_TYPES.REPORT_CLIENT_STATE);
      if (pendingActivation?.intent === 'automatic' && !isPageInErrorState()) {
        pendingActivation = undefined;
        showManualUpdateBanner();
      }
    });
  }

  return {
    isReloadPending: () =>
      isReloading || pendingActivation?.intent === 'automatic',
    requestVersionCheck,
    setup,
    tryAutoReloadOnPageError,
  };
}
