// from https://github.com/magicismight/react-native-root-portal
/* eslint-disable no-plusplus */
import type { ReactNode } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';

import ChildrenWrapper from 'react-native-root-siblings/lib/ChildrenWrapper';
import wrapRootComponent from 'react-native-root-siblings/lib/wrapRootComponent';
import { withStaticProperties } from 'tamagui';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { RootSiblingManager } from 'react-native-root-siblings/lib/wrapRootComponent';

const portalManagers: Map<string, RootSiblingManager> = new Map();
let portalUuid = 0;

function setPortalManager(name: string, manager: RootSiblingManager) {
  portalManagers.set(name, manager);
}

function createPortalId(id: number): string {
  return `portal:${id}`;
}

function isPortalExisted(name: string): boolean {
  return portalManagers.has(name);
}

export enum EPortalContainerConstantName {
  WEB_TAB_BAR = 'ONEKEY_WEB_TAB_BAR',
  SIDEBAR_BANNER = 'SIDEBAR_BANNER',
  APP_STATE_LOCK_CONTAINER_OVERLAY = 'APP_STATE_LOCK_CONTAINER_OVERLAY',
  SPOTLIGHT_OVERLAY_PORTAL = 'ONEKEY-Root-SPOTLIGHT_OVERLAY_PORTAL',
  FULL_WINDOW_OVERLAY_PORTAL = 'ONEKEY-Root-FullWindowOverlay',
  TOASTER_OVERLAY_PORTAL = 'ONEKEY_TOASTER_OVERLAY_PORTAL',
  ACCOUNT_SELECTOR = 'ONEKEY_ACCOUNT_SELECTOR',
  WALLET_ACTIONS = 'ONEKEY_WALLET_ACTIONS',
}

export interface IPortalManager {
  update: (
    updater: ReactNode,
    updateCallback?: (() => void) | undefined,
  ) => void;
  destroy: (destroyCallback?: () => void) => void;
}

const MAX_RETRY_TIMES = 10;

const retryDuration = (retryTimes: number) => 80 + retryTimes * 50;

function renderToPortal(
  container: EPortalContainerConstantName,
  guest: ReactNode,
  callback?: () => void,
): IPortalManager {
  const id = createPortalId(++portalUuid);
  const manager: {
    ref: RootSiblingManager | undefined;
  } = { ref: undefined };

  const retryUpdate = (retryTimes = 0) => {
    manager.ref = portalManagers.get(container);
    if (manager.ref) {
      manager.ref.update(id, guest, callback);
    } else if (retryTimes < MAX_RETRY_TIMES) {
      // manager not exists, may be portalManagers not init yet,
      // try again in 600ms
      setTimeout(() => {
        defaultLogger.app.component.renderPortalFailed(
          'renderToPortal',
          container,
        );
        retryUpdate(retryTimes + 1);
      }, retryDuration(retryTimes));
    }
  };
  retryUpdate();
  return {
    update: (updater: ReactNode, updateCallback?: () => void) => {
      manager.ref?.update(id, updater, updateCallback);
    },
    destroy: (destroyCallback?: () => void) => {
      manager.ref?.destroy(id, destroyCallback);
    },
  };
}

function PortalRender(props: {
  children: ReactNode;
  container?: EPortalContainerConstantName;
  destroyDelayMs?: number;
}) {
  const { children, container, destroyDelayMs = 0 } = props;

  if (platformEnv.isDev) {
    if (children) {
      const isReactMemoElement = (child?: {
        elementType?: { $$typeof?: symbol };
      }) => child?.elementType?.$$typeof?.toString() !== 'Symbol(react.memo)';
      const { _owner } = children as any as {
        _owner?: {
          child?: any;
          sibling?: any;
        };
      };
      if (
        !isReactMemoElement(_owner?.child) &&
        !isReactMemoElement(_owner?.sibling)
      ) {
        console.error(
          `use React.memo or React.useMemo with a Component contains children in Portal.Body ${
            container || ''
          }`,
        );
      }
    }
  }

  const [retryTimes, updateRetryTimes] = useState(0);

  const managerController = useMemo(() => {
    const manager = container ? portalManagers.get(container) : null;
    let portalId = '';
    if (manager) {
      portalId = createPortalId(++portalUuid);
    }
    let prevChildren: ReactNode | null = null;
    return {
      destroy() {
        if (manager && portalId) {
          manager?.destroy(portalId);
        }
      },
      update(c: ReactNode) {
        if (!container) {
          return;
        }
        if (c === prevChildren) {
          return true;
        }
        if (manager && portalId) {
          manager.update(portalId, <>{c}</>);
          prevChildren = c;
          return true;
        }
        console.error(
          `react-native-root-portal: Can not find target PortalContainer named:'${container}'.`,
        );
      },
    };
    // fetch portalManagers by every retry times.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, retryTimes]);

  // * try first time by sync (iOS required, web not inited yet)
  managerController.update(children);

  useEffect(
    () => () => {
      // * destroy component
      setTimeout(() => {
        managerController.destroy();
      }, destroyDelayMs);
    },
    [destroyDelayMs, managerController],
  );

  useEffect(() => {
    if (!container) {
      return;
    }

    // * try 2nd time by async (web render here)
    const isUpdated = managerController.update(children);

    // * try 3rd time by setTimeout
    if (retryTimes < MAX_RETRY_TIMES && !isUpdated) {
      // manager not exists, may be portalManagers not init yet,
      // try again in 600ms
      setTimeout(() => {
        defaultLogger.app.component.renderPortalFailed(
          'PortalRender',
          container,
        );
        updateRetryTimes((i) => i + 1);
      }, retryDuration(retryTimes));
    }
  }, [children, container, managerController, retryTimes]);

  if (!container) {
    return <>{children}</>;
  }

  return null;
}

const MemoPortalRender = memo(PortalRender);

function PortalContainer(props: {
  name: string;
  renderSibling?: (sibling: ReactNode) => ReactNode;
  children?: ReactNode;
}) {
  const { name, renderSibling, children } = props;
  const sibling = useMemo(() => {
    const { Root, manager } = wrapRootComponent(ChildrenWrapper, renderSibling);

    if (isPortalExisted(name)) {
      console.warn(
        `react-native-root-portal: Another PortalContainer named:'${name}' is already existed.`,
      );
    }

    setPortalManager(name, manager);
    return {
      Root,
      manager,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!portalManagers.has(name)) {
      setPortalManager(name, sibling.manager);
    }

    return () => {
      portalManagers.delete(name);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const { Root } = sibling;
  return (
    <>
      {children}
      <Root />
    </>
  );
}

export const Portal = withStaticProperties(PortalContainer, {
  Container: PortalContainer,
  Body: MemoPortalRender,
  Render: renderToPortal,
  Constant: EPortalContainerConstantName,
});
