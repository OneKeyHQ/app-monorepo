// from https://github.com/magicismight/react-native-root-portal
/* eslint-disable no-plusplus */
import type { FC, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import ChildrenWrapper from 'react-native-root-siblings/lib/ChildrenWrapper';
import wrapRootComponent from 'react-native-root-siblings/lib/wrapRootComponent';

import type { RootSiblingManager } from 'react-native-root-siblings/lib/wrapRootComponent';

const portalManagers: Map<string, RootSiblingManager> = new Map();
let portalUuid = 0;

function setPortalManager(name: string, manager: RootSiblingManager) {
  portalManagers.set(name, manager);

  // simulate lazy set portal manager
  // setTimeout(() => {
  //   portalManagers.set(name, manager);
  // }, 600);
}

function createPortalId(id: number): string {
  return `portal:${id}`;
}

export function isPortalExisted(name: string): boolean {
  return portalManagers.has(name);
}

export interface PortalManager {
  update: (
    updater: ReactNode,
    updateCallback?: (() => void) | undefined,
  ) => void;
  destroy: (destroyCallback?: () => void) => void;
}

export function renderToPortal(
  container: string,
  guest: ReactNode,
  callback?: () => void,
): PortalManager {
  const manager = portalManagers.get(container);
  const id = createPortalId(++portalUuid);

  if (manager) {
    manager.update(id, guest, callback);
  } else {
    throw new Error(
      `react-native-root-portal: Can not find target PortalContainer named:'${container}'.`,
    );
  }

  return {
    update: (updater: ReactNode, updateCallback?: () => void) => {
      manager.update(id, updater, updateCallback);
    },
    destroy: (destroyCallback?: () => void) => {
      manager.destroy(id, destroyCallback);
    },
  };
}

export function PortalRender(props: {
  children: ReactNode;
  container?: string;
}) {
  const { children, container } = props;
  const [retry, setRetry] = useState(false);

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
  }, [container]);

  // * try first time by sync (iOS required, web not inited yet)
  managerController.update(children);

  useEffect(
    () => () => {
      // * destroy component
      managerController.destroy();
    },
    [managerController],
  );

  useEffect(() => {
    if (!container) {
      return;
    }

    // * try 2nd time by async (web render here)
    const isUpdated = managerController.update(children);

    // * try 3rd time by setTimeout
    if (!retry && !isUpdated) {
      // manager not exists, may be portalManagers not init yet,
      // try again in 600ms
      setTimeout(() => {
        console.error(
          `react-native-root-portal: retry load PortalContainer:'${container}'.`,
        );
        setRetry(true);
      }, 800);
    }
  }, [children, container, managerController, retry]);

  if (!container) {
    return <>{children}</>;
  }

  return null;
}

export function PortalContainer(props: {
  name: string;
  renderSibling?: (sibling: ReactNode) => ReactNode;
  children?: ReactNode;
}) {
  const { name, renderSibling, children } = props;

  const sibling = useMemo<{
    Root: FC;
    manager: RootSiblingManager;
  }>(() => {
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
