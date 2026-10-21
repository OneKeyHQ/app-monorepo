import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors/errors/localError';

export type IImperativeOverlayTarget =
  | 'global'
  | 'page'
  | 'hardware-stage'
  | 'lock';

export interface IImperativeOverlayPageKey {
  hostKey: string;
  ownerKey: string;
}

type IWrapOverlay = (node: ReactNode) => ReactNode;

interface IOverlayMountEntry {
  id: number;
  target: IImperativeOverlayTarget;
  page?: IImperativeOverlayPageKey;
  node: ReactNode;
  wrap?: IWrapOverlay;
  onPageUnavailable?: () => void;
  onHostUnavailable?: () => void;
}

export interface IImperativeOverlayMountHandle {
  update: (node: ReactNode, callback?: () => void) => void;
  destroy: (callback?: () => void) => void;
}

const entries = new Map<number, IOverlayMountEntry>();
const pageBindings = new Map<string, { token: symbol; wrap: IWrapOverlay }>();
const removedPages = new Set<string>();
const listeners = new Set<() => void>();
let snapshot: IOverlayMountEntry[] = [];
let nextId = 0;

function pageId(page: IImperativeOverlayPageKey) {
  return `${page.hostKey}\0${page.ownerKey}`;
}

function publish() {
  snapshot = [...entries.values()];
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;

export function registerImperativeOverlayPage(
  page: IImperativeOverlayPageKey,
  wrap: IWrapOverlay,
) {
  const key = pageId(page);
  const token = Symbol(key);
  removedPages.delete(key);
  pageBindings.set(key, { token, wrap });
  for (const entry of entries.values()) {
    if (entry.target === 'page' && entry.page && pageId(entry.page) === key) {
      entries.set(entry.id, { ...entry, wrap });
    }
  }
  publish();
  return {
    update(updatedWrap: IWrapOverlay) {
      if (pageBindings.get(key)?.token !== token) {
        return;
      }
      pageBindings.set(key, { token, wrap: updatedWrap });
      for (const entry of entries.values()) {
        if (
          entry.target === 'page' &&
          entry.page &&
          pageId(entry.page) === key
        ) {
          entries.set(entry.id, { ...entry, wrap: updatedWrap });
        }
      }
      publish();
    },
    unregister() {
      if (pageBindings.get(key)?.token !== token) {
        return;
      }
      pageBindings.delete(key);
      removedPages.add(key);
      for (const entry of entries.values()) {
        if (
          entry.target === 'page' &&
          entry.page &&
          pageId(entry.page) === key
        ) {
          entry.onPageUnavailable?.();
          if (!entry.wrap) {
            entries.delete(entry.id);
          }
        }
      }
      publish();
    },
  };
}

export function mountImperativeOverlay({
  target,
  page,
  node,
  wrap,
  onPageUnavailable,
  onHostUnavailable,
}: {
  target: IImperativeOverlayTarget;
  page?: IImperativeOverlayPageKey;
  node: ReactNode;
  wrap?: IWrapOverlay;
  onPageUnavailable?: () => void;
  onHostUnavailable?: () => void;
}): IImperativeOverlayMountHandle {
  if (target === 'page' && (!page?.hostKey || !page.ownerKey)) {
    throw new OneKeyLocalError('Page overlay requires a source host and owner');
  }
  if (target === 'page' && page && removedPages.has(pageId(page))) {
    void Promise.resolve().then(() => onPageUnavailable?.());
    return {
      update: (_updatedNode, callback) => callback?.(),
      destroy: (callback) => callback?.(),
    };
  }
  nextId += 1;
  const id = nextId;
  const pageWrap = page ? pageBindings.get(pageId(page))?.wrap : undefined;
  entries.set(id, {
    id,
    target,
    page,
    node,
    wrap: target === 'page' ? pageWrap : wrap,
    onPageUnavailable,
    onHostUnavailable,
  });
  publish();
  return {
    update: (updatedNode, callback) => {
      const entry = entries.get(id);
      if (entry) {
        entries.set(id, { ...entry, node: updatedNode });
        publish();
      }
      callback?.();
    },
    destroy: (callback) => {
      if (entries.delete(id)) {
        publish();
      }
      callback?.();
    },
  };
}

export function ImperativeOverlayMountHost({
  target,
}: {
  target: IImperativeOverlayTarget;
}) {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (target !== 'lock') {
      return;
    }
    return () => {
      for (const entry of entries.values()) {
        if (entry.target === 'lock') {
          entry.onHostUnavailable?.();
          entries.delete(entry.id);
        }
      }
      publish();
    };
  }, [target]);
  return (
    <>
      {current.map((entry) =>
        entry.target === target && (entry.target !== 'page' || entry.wrap) ? (
          <Fragment key={entry.id}>
            {entry.wrap ? entry.wrap(entry.node) : entry.node}
          </Fragment>
        ) : null,
      )}
    </>
  );
}

export function ImperativeOverlayMountBody({
  target,
  children,
}: {
  target: Exclude<IImperativeOverlayTarget, 'page'>;
  children: ReactNode;
}) {
  const handleRef = useRef<IImperativeOverlayMountHandle | undefined>(
    undefined,
  );
  const latestChildren = useRef(children);
  latestChildren.current = children;
  useLayoutEffect(() => {
    const handle = mountImperativeOverlay({
      target,
      node: latestChildren.current,
    });
    handleRef.current = handle;
    return () => {
      if (handleRef.current === handle) {
        handleRef.current = undefined;
      }
      handle.destroy();
    };
  }, [target]);
  useLayoutEffect(() => {
    handleRef.current?.update(children);
  }, [children]);
  return null;
}
