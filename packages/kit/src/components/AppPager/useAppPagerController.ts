import {
  useCallback,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { RefObject } from 'react';

import { useSharedValue } from 'react-native-reanimated';

import type {
  IAppPagerChange,
  IAppPagerCommands,
  IAppPagerIdentity,
} from './types';

export function useAppPagerController({
  pages,
  initialTabName,
  pagerRef,
  commitOnCommand = false,
  onSelectionChange,
  onBeforeCommand,
  removedPageFallback,
}: {
  pages: readonly IAppPagerIdentity[];
  removedPageFallback?: { tabName: string; notifySelectionChange?: boolean };
  initialTabName?: string;
  pagerRef: RefObject<IAppPagerCommands | null>;
  commitOnCommand?: boolean;
  onSelectionChange?: (event: IAppPagerChange) => void;
  onBeforeCommand?: (
    index: number,
    animated: boolean,
    reason: 'command' | 'sync' | 'reconcile',
  ) => void;
}) {
  const initialIndex = useRef(
    Math.max(
      0,
      pages.findIndex((page) => page.name === initialTabName),
    ),
  ).current;
  const [selectedKey, setSelectedKey] = useState<string | undefined>(
    pages[initialIndex]?.key,
  );
  const keyIndex = pages.findIndex((page) => page.key === selectedKey);
  const selectedIndex = Math.max(
    0,
    keyIndex >= 0
      ? keyIndex
      : pages.findIndex((page) => page.name === removedPageFallback?.tabName),
  );
  const selectedIndexRef = useRef(selectedIndex);
  const pagesRef = useRef(pages);
  const reconciling = useRef(false);
  const pendingCommand = useRef<
    { key: string; animated?: boolean; reason?: 'sync' } | undefined
  >(undefined);
  const mounted = useRef(false);
  const selectionRevision = useRef(0);
  const committedSelectionRevision = useRef(0);
  const callbacks = useRef({
    onSelectionChange,
    onBeforeCommand,
    commitOnCommand,
  });
  // Publish one committed configuration before descendants run layout commands.
  useInsertionEffect(() => {
    pagesRef.current = pages;
    callbacks.current = { onSelectionChange, onBeforeCommand, commitOnCommand };
    selectedIndexRef.current = selectedIndex;
    committedSelectionRevision.current = selectionRevision.current;
    reconciling.current = true;
  }, [
    pages,
    onSelectionChange,
    onBeforeCommand,
    commitOnCommand,
    selectedIndex,
  ]);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingCommand.current = undefined;
    };
  }, []);
  const focusedTab = useSharedValue(pages[initialIndex]?.name ?? '');
  const indexDecimal = useSharedValue(initialIndex);
  const selectIndex = useCallback(
    (index: number, notify = true) => {
      const page = pagesRef.current[index];
      if (!Number.isInteger(index) || !page) return;
      const previous = selectedIndexRef.current;
      selectedIndexRef.current = index;
      selectionRevision.current += 1;
      setSelectedKey(page.key);
      focusedTab.value = page.name;
      if (notify)
        callbacks.current.onSelectionChange?.({
          prevIndex: previous,
          index,
          prevTabName: pagesRef.current[previous]?.name ?? '',
          tabName: page.name,
        });
    },
    [focusedTab],
  );
  const setIndex = useCallback(
    (index: number, animated?: boolean) => {
      if (!Number.isInteger(index) || !pagesRef.current[index]) return;
      if (reconciling.current) {
        pendingCommand.current = { key: pagesRef.current[index].key, animated };
        return;
      }
      pendingCommand.current = undefined;
      const shouldAnimate =
        animated ?? Math.abs(index - selectedIndexRef.current) <= 1;
      callbacks.current.onBeforeCommand?.(index, shouldAnimate, 'command');
      if (!shouldAnimate) indexDecimal.value = index;
      if (callbacks.current.commitOnCommand) selectIndex(index, false);
      if (shouldAnimate) pagerRef.current?.setPage(index);
      else pagerRef.current?.setPageWithoutAnimation(index);
    },
    [indexDecimal, pagerRef, selectIndex],
  );
  const jumpToTab = useCallback(
    (name: string, animated?: boolean) => {
      setIndex(
        pagesRef.current.findIndex((page) => page.name === name),
        animated,
      );
    },
    [setIndex],
  );
  const syncCurrentPage = useCallback(
    (
      index = selectedIndexRef.current,
      reason: 'sync' | 'reconcile' = 'sync',
    ) => {
      if (!pagesRef.current[index]) return;
      if (reconciling.current && reason === 'sync') {
        pendingCommand.current = {
          key: pagesRef.current[index].key,
          animated: false,
          reason,
        };
        return;
      }
      if (reason === 'sync') pendingCommand.current = undefined;
      callbacks.current.onBeforeCommand?.(index, false, reason);
      if (callbacks.current.commitOnCommand) selectIndex(index, false);
      indexDecimal.value = index;
      pagerRef.current?.setPageWithoutAnimation(index);
    },
    [indexDecimal, pagerRef, selectIndex],
  );
  const previousPages = useRef(pages);
  useLayoutEffect(() => {
    try {
      const previous = previousPages.current;
      const keysChanged =
        previous.length !== pages.length ||
        pages.some((page, index) => page.key !== previous[index]?.key);
      const namesChanged = pages.some(
        (page, index) => page.name !== previous[index]?.name,
      );
      previousPages.current = pages;
      if (!keysChanged && !namesChanged) return;
      // A descendant may already have selected a page in this commit.
      if (selectionRevision.current !== committedSelectionRevision.current)
        return;
      const page = pages[selectedIndex];
      focusedTab.value = page?.name ?? '';
      if (!page) {
        setSelectedKey(undefined);
        return;
      }
      const removed = page.key !== selectedKey;
      if (removed)
        selectIndex(
          selectedIndex,
          removedPageFallback?.notifySelectionChange ?? true,
        );
      if (keysChanged) syncCurrentPage(selectedIndex, 'reconcile');
    } finally {
      reconciling.current = false;
      const command = pendingCommand.current;
      if (command)
        queueMicrotask(() => {
          if (!mounted.current || pendingCommand.current !== command) return;
          pendingCommand.current = undefined;
          const index = pagesRef.current.findIndex(
            (page) => page.key === command.key,
          );
          if (command.reason) syncCurrentPage(index, command.reason);
          else setIndex(index, command.animated);
        });
    }
  }, [
    pages,
    selectedIndex,
    selectedKey,
    focusedTab,
    selectIndex,
    setIndex,
    syncCurrentPage,
    onSelectionChange,
    onBeforeCommand,
    commitOnCommand,
    removedPageFallback?.notifySelectionChange,
  ]);
  const getCurrentIndex = useCallback(() => selectedIndexRef.current, []);
  const getFocusedTab = useCallback(
    () => pagesRef.current[selectedIndexRef.current]?.name ?? '',
    [],
  );
  return {
    initialIndex,
    selectedIndex,
    selectedIndexRef,
    focusedName: pages[selectedIndex]?.name ?? '',
    focusedTab,
    indexDecimal,
    selectIndex,
    setIndex,
    jumpToTab,
    syncCurrentPage,
    getCurrentIndex,
    getFocusedTab,
  };
}
