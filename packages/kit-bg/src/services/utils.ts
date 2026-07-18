import {
  EXTENSION_FOREGROUND_RESET_COMMIT_METHOD_NAME,
  EXTENSION_FOREGROUND_RESET_METHOD_NAME,
  EXTENSION_FOREGROUND_RESET_RESUME_METHOD_NAME,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EXT_UI_TO_BG_PORT_NAME } from '@onekeyhq/shared/types';

import type { JsBridgeExtBackground } from '@onekeyfe/extension-bridge-hosted';

const EXTENSION_FOREGROUND_RESET_DEADLINE_MS = 30_000;
const EXTENSION_FOREGROUND_RESUME_DEADLINE_MS = 5000;

type IExtensionForegroundConnectionTracker = {
  dispose: () => void;
  getRevision: () => number;
};

const createExtensionForegroundConnectionTracker =
  (): IExtensionForegroundConnectionTracker => {
    let revision = 0;
    const handleConnect = (port: chrome.runtime.Port) => {
      if (port.name === EXT_UI_TO_BG_PORT_NAME) {
        revision += 1;
      }
    };
    chrome.runtime.onConnect.addListener(handleConnect);
    return {
      dispose: () => chrome.runtime.onConnect.removeListener(handleConnect),
      getRevision: () => revision,
    };
  };

const checkExtUIOpen = (bridgeExtBg: JsBridgeExtBackground) => {
  const currentExtOrigin = chrome.runtime.getURL('');
  const { ports } = bridgeExtBg;
  const oneKeyUIPort = Object.values(ports).filter(
    (port) => port.name === EXT_UI_TO_BG_PORT_NAME,
  );
  if (
    oneKeyUIPort.length > 0 &&
    oneKeyUIPort[0].sender?.origin &&
    currentExtOrigin.includes(oneKeyUIPort[0].sender?.origin)
  ) {
    return true;
  }
  return false;
};

async function waitForExtensionForegroundMethod({
  bridgeExtBg,
  deadlineAt,
  method,
  port,
  portId,
}: {
  bridgeExtBg: JsBridgeExtBackground;
  deadlineAt: number;
  method:
    | typeof EXTENSION_FOREGROUND_RESET_COMMIT_METHOD_NAME
    | typeof EXTENSION_FOREGROUND_RESET_METHOD_NAME
    | typeof EXTENSION_FOREGROUND_RESET_RESUME_METHOD_NAME;
  port: chrome.runtime.Port;
  portId: string;
}) {
  const remainingTimeMs = deadlineAt - Date.now();
  if (remainingTimeMs <= 0) {
    throw new OneKeyLocalError(
      `Extension foreground reset deadline exceeded: ${portId}`,
    );
  }
  let handleDisconnect: (() => void) | undefined;
  const disconnected = new Promise<'disconnected'>((resolve) => {
    handleDisconnect = () => resolve('disconnected');
    port.onDisconnect.addListener(handleDisconnect);
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = bridgeExtBg.request({
      data: {
        method,
      },
      remoteId: portId,
    });
    if (!request) {
      throw new OneKeyLocalError(
        'Extension foreground reset request was not created',
      );
    }
    const waiters: Promise<'acknowledged' | 'disconnected'>[] = [
      request.then(() => 'acknowledged' as const),
      disconnected,
    ];
    waiters.push(
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(
            new OneKeyLocalError(
              `Extension foreground reset deadline exceeded: ${portId}`,
            ),
          );
        }, remainingTimeMs);
      }),
    );
    return await Promise.race(waiters);
  } catch (error) {
    if (bridgeExtBg.ports[portId] !== port) {
      return 'disconnected' as const;
    }
    throw error;
  } finally {
    if (handleDisconnect) {
      port.onDisconnect.removeListener(handleDisconnect);
    }
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

const runExtensionForegroundMethod = async ({
  acknowledgedPorts = new Set<chrome.runtime.Port>(),
  bridgeExtBg,
  deadlineAt = Date.now() + EXTENSION_FOREGROUND_RESET_DEADLINE_MS,
  eligiblePorts,
  method,
}: {
  acknowledgedPorts?: Set<chrome.runtime.Port>;
  bridgeExtBg: JsBridgeExtBackground | null | undefined;
  deadlineAt?: number;
  eligiblePorts?: Set<chrome.runtime.Port>;
  method:
    | typeof EXTENSION_FOREGROUND_RESET_COMMIT_METHOD_NAME
    | typeof EXTENSION_FOREGROUND_RESET_METHOD_NAME;
}) => {
  if (!bridgeExtBg) {
    throw new OneKeyLocalError('Extension foreground bridge is not ready');
  }
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const uiPorts = Object.entries(bridgeExtBg.ports).filter(
      ([, port]) => port.name === EXT_UI_TO_BG_PORT_NAME,
    );
    const pendingPorts = uiPorts.filter(
      ([, port]) =>
        (!eligiblePorts || eligiblePorts.has(port)) &&
        !acknowledgedPorts.has(port),
    );
    if (pendingPorts.length === 0) {
      return uiPorts
        .filter(([, port]) => !eligiblePorts || eligiblePorts.has(port))
        .map(([portId]) => portId)
        .toSorted();
    }

    const results = await Promise.allSettled(
      pendingPorts.map(async ([portId, port]) => {
        const result = await waitForExtensionForegroundMethod({
          bridgeExtBg,
          deadlineAt,
          method,
          port,
          portId,
        });
        // A reconnect may reuse the same bridge id. Bind the ACK to the exact
        // Port object that answered so a replacement runtime cannot inherit it.
        if (result === 'acknowledged' && bridgeExtBg.ports[portId] === port) {
          acknowledgedPorts.add(port);
        }
      }),
    );
    const failures = results.flatMap((result, index) =>
      result.status === 'rejected'
        ? [{ portId: pendingPorts[index][0], reason: result.reason as unknown }]
        : [],
    );
    if (failures.length === 1 && failures[0].reason instanceof Error) {
      throw failures[0].reason;
    }
    if (failures.length > 0) {
      throw new OneKeyLocalError(
        `Extension foreground reset failed: ${failures
          .map(({ portId }) => portId)
          .join(', ')}`,
      );
    }
  }
};

const quiesceExtensionForegrounds = ({
  acknowledgedPorts,
  bridgeExtBg,
  deadlineAt,
}: {
  acknowledgedPorts?: Set<chrome.runtime.Port>;
  bridgeExtBg: JsBridgeExtBackground | null | undefined;
  deadlineAt?: number;
}) =>
  runExtensionForegroundMethod({
    acknowledgedPorts,
    bridgeExtBg,
    deadlineAt,
    method: EXTENSION_FOREGROUND_RESET_METHOD_NAME,
  });

const commitExtensionForegrounds = ({
  bridgeExtBg,
  deadlineAt,
  preparedPorts,
}: {
  bridgeExtBg: JsBridgeExtBackground | null | undefined;
  deadlineAt?: number;
  preparedPorts: Set<chrome.runtime.Port>;
}) =>
  runExtensionForegroundMethod({
    bridgeExtBg,
    deadlineAt,
    eligiblePorts: preparedPorts,
    method: EXTENSION_FOREGROUND_RESET_COMMIT_METHOD_NAME,
  });

const prepareAndCommitExtensionForegrounds = async ({
  bridgeExtBg,
  connectionTracker,
  deadlineAt = Date.now() + EXTENSION_FOREGROUND_RESET_DEADLINE_MS,
  preparedPorts = new Set<chrome.runtime.Port>(),
}: {
  bridgeExtBg: JsBridgeExtBackground | null | undefined;
  connectionTracker?: IExtensionForegroundConnectionTracker;
  deadlineAt?: number;
  preparedPorts?: Set<chrome.runtime.Port>;
}) => {
  if (!bridgeExtBg) {
    throw new OneKeyLocalError('Extension foreground bridge is not ready');
  }
  // A foreground can connect or replace another runtime between PREPARE and
  // COMMIT. Commit only exact prepared Port objects, then repeat until both
  // the connection revision and current port set are stable.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const revisionBefore = connectionTracker?.getRevision();
    await quiesceExtensionForegrounds({
      acknowledgedPorts: preparedPorts,
      bridgeExtBg,
      deadlineAt,
    });
    await commitExtensionForegrounds({
      bridgeExtBg,
      deadlineAt,
      preparedPorts,
    });
    const currentUiPorts = Object.values(bridgeExtBg.ports).filter(
      (port) => port.name === EXT_UI_TO_BG_PORT_NAME,
    );
    const revisionAfter = connectionTracker?.getRevision();
    if (
      currentUiPorts.every((port) => preparedPorts.has(port)) &&
      (revisionBefore === undefined || revisionBefore === revisionAfter)
    ) {
      return Object.entries(bridgeExtBg.ports)
        .filter(
          ([, port]) =>
            port.name === EXT_UI_TO_BG_PORT_NAME && preparedPorts.has(port),
        )
        .map(([portId]) => portId)
        .toSorted();
    }
  }
};

const resumeExtensionForegrounds = async ({
  bridgeExtBg,
  deadlineAt = Date.now() + EXTENSION_FOREGROUND_RESUME_DEADLINE_MS,
}: {
  bridgeExtBg: JsBridgeExtBackground | null | undefined;
  deadlineAt?: number;
}): Promise<void> => {
  if (!bridgeExtBg) {
    return;
  }
  const uiPorts = Object.entries(bridgeExtBg.ports).filter(
    ([, port]) => port.name === EXT_UI_TO_BG_PORT_NAME,
  );
  const results = await Promise.allSettled(
    uiPorts.map(([portId, port]) =>
      waitForExtensionForegroundMethod({
        bridgeExtBg,
        deadlineAt,
        method: EXTENSION_FOREGROUND_RESET_RESUME_METHOD_NAME,
        port,
        portId,
      }),
    ),
  );
  const failedPortIds = results.flatMap((result, index) =>
    result.status === 'rejected' ? [uiPorts[index][0]] : [],
  );
  if (failedPortIds.length > 0) {
    throw new OneKeyLocalError(
      `Extension foreground reset resume failed: ${failedPortIds.join(', ')}`,
    );
  }
};

export {
  EXTENSION_FOREGROUND_RESET_DEADLINE_MS,
  EXTENSION_FOREGROUND_RESUME_DEADLINE_MS,
  checkExtUIOpen,
  commitExtensionForegrounds,
  createExtensionForegroundConnectionTracker,
  prepareAndCommitExtensionForegrounds,
  quiesceExtensionForegrounds,
  resumeExtensionForegrounds,
};

export type { IExtensionForegroundConnectionTracker };
