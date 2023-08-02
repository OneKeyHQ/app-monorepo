// from https://github.com/magicismight/react-native-root-portal
/* eslint-disable no-plusplus */
import type { FC, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import ChildrenWrapper from 'react-native-root-siblings/lib/ChildrenWrapper';
import wrapRootComponent from 'react-native-root-siblings/lib/wrapRootComponent';

import type { RootSiblingManager } from 'react-native-root-siblings/lib/wrapRootComponent';

const portalManagers: Map<string, RootSiblingManager> = new Map();
let portalUuid = 0;

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

export function enterPortal(
  target: string,
  guest: ReactNode,
  callback?: () => void,
): PortalManager {
  const manager = portalManagers.get(target);
  const id = createPortalId(++portalUuid);

  if (manager) {
    manager.update(id, guest, callback);
  } else {
    throw new Error(
      `react-native-root-portal: Can not find target PortalExit named:'${target}'.`,
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

export function PortalEntry(props: { children: ReactNode; target?: string }) {
  const { children, target } = props;
  const manager = target ? portalManagers.get(target) : null;
  const [id] = useState<number>(() => ++portalUuid);

  useEffect(() => {
    if (manager) {
      return () => manager.destroy(createPortalId(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager]);

  if (manager) {
    manager.update(createPortalId(id), <>{children}</>);
  } else if (target) {
    console.error(
      `react-native-root-portal: Can not find target PortalExit named:'${target}'.`,
    );
  } else {
    return <>{children}</>;
  }

  return null;
}

export function PortalExit(props: {
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
        `react-native-root-portal: Another PortalExit named:'${name}' is already existed.`,
      );
    }

    portalManagers.set(name, manager);
    return {
      Root,
      manager,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!portalManagers.has(name)) {
      portalManagers.set(name, sibling.manager);
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

export default {
  Entry: PortalEntry,
  Exit: PortalExit,
  isExisted: isPortalExisted,
  enter: enterPortal,
};
