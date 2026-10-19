/** @jest-environment jsdom */

import {
  Suspense,
  createElement,
  act as rendererAct,
  startTransition,
  useCallback,
  useLayoutEffect,
  useState,
} from 'react';

import { act, renderHook } from '@testing-library/react-native';
import { createRoot } from 'react-dom/client';

import { useAppPagerController } from './useAppPagerController';

jest.mock('react-native-reanimated', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: (value: unknown) => react.useRef({ value }).current,
  };
});

const a = { key: 'a', name: 'A' };
const b = { key: 'b', name: 'B' };
const c = { key: 'c', name: 'C' };
const d = { key: 'd', name: 'D' };

function setup(pages = [a, b, c, d], commitOnCommand = false) {
  const commands = { setPage: jest.fn(), setPageWithoutAnimation: jest.fn() };
  const pagerRef = { current: commands };
  const onSelectionChange = jest.fn();
  const hook = renderHook<
    ReturnType<typeof useAppPagerController>,
    { items: { key: string; name: string }[] }
  >(
    ({ items }) =>
      useAppPagerController({
        pages: items,
        pagerRef,
        initialTabName: 'B',
        commitOnCommand,
        onSelectionChange,
      }),
    { initialProps: { items: pages } },
  );
  return { ...hook, commands, onSelectionChange };
}

it('keeps the initial SDK page stable and commits Home selection only on accepted callbacks', () => {
  const { result, commands, onSelectionChange } = setup();
  expect(result.current.initialIndex).toBe(1);
  act(() => result.current.setIndex(2));
  expect(commands.setPage).toHaveBeenCalledWith(2);
  expect(result.current.getFocusedTab()).toBe('B');
  expect(onSelectionChange).not.toHaveBeenCalled();
  act(() => result.current.selectIndex(2));
  expect(result.current.getFocusedTab()).toBe('C');
  expect(result.current.initialIndex).toBe(1);
  expect(onSelectionChange).toHaveBeenCalledTimes(1);
});

it('commits native Market commands immediately without synthesizing domain callbacks', () => {
  const { result, commands, onSelectionChange } = setup(undefined, true);
  act(() => result.current.setIndex(3, false));
  expect(result.current.getCurrentIndex()).toBe(3);
  expect(result.current.getFocusedTab()).toBe('D');
  expect(commands.setPageWithoutAnimation).toHaveBeenCalledWith(3);
  expect(onSelectionChange).not.toHaveBeenCalled();
  act(() => result.current.syncCurrentPage());
  expect(onSelectionChange).not.toHaveBeenCalled();
  act(() => result.current.selectIndex(2));
  expect(onSelectionChange).toHaveBeenCalledWith(
    expect.objectContaining({ prevIndex: 3, index: 2, tabName: 'C' }),
  );
});

it('preserves the key on reorder and reports selected removal once', () => {
  const { result, rerender, commands, onSelectionChange } = setup();
  rerender({ items: [d, b, a, c] });
  expect(result.current.getFocusedTab()).toBe('B');
  expect(commands.setPageWithoutAnimation).toHaveBeenCalledWith(1);
  rerender({ items: [d, a, c] });
  expect(result.current.getFocusedTab()).toBe('D');
  expect(onSelectionChange).toHaveBeenCalledTimes(1);
  rerender({ items: [d, a, c] });
  expect(onSelectionChange).toHaveBeenCalledTimes(1);
});

it('refreshes labels and getters without jumping or clearing intermediate progress', () => {
  const { result, rerender, commands } = setup();
  const getFocusedTab = result.current.getFocusedTab;
  result.current.indexDecimal.value = 1.4;
  rerender({ items: [a, { ...b, name: 'Renamed' }, c, d] });
  expect(result.current.focusedTab.value).toBe('Renamed');
  expect(getFocusedTab()).toBe('Renamed');
  expect(result.current.indexDecimal.value).toBe(1.4);
  expect(commands.setPageWithoutAnimation).not.toHaveBeenCalled();
});

it('rejects invalid commands and safely reconciles empty pages', () => {
  const { result, commands, rerender } = setup([]);
  act(() => {
    for (const index of [-1, 0, 0.5, NaN]) result.current.setIndex(index);
    result.current.jumpToTab('missing');
    result.current.selectIndex(99);
  });
  expect(commands.setPage).not.toHaveBeenCalled();
  expect(commands.setPageWithoutAnimation).not.toHaveBeenCalled();
  expect(result.current.getFocusedTab()).toBe('');
  rerender({ items: [c, a] });
  expect(result.current.getFocusedTab()).toBe('C');
  expect(result.current.initialIndex).toBe(0);
  rerender({ items: [] });
  expect(result.current.getFocusedTab()).toBe('');
});

it('keeps commands, getters and callbacks on the committed snapshot during Suspense', async () => {
  const commands = { setPage: jest.fn(), setPageWithoutAnimation: jest.fn() };
  const committed = jest.fn();
  const speculative = jest.fn();
  let api: ReturnType<typeof useAppPagerController> | undefined;
  let update: (value: boolean) => void = () => {};
  const pending = new Promise<void>(() => {});
  function Pager({ reordered }: { reordered: boolean }) {
    const controller = useAppPagerController({
      pages: reordered ? [c, b, a] : [a, b, c],
      initialTabName: 'A',
      pagerRef: { current: commands },
      onSelectionChange: reordered ? speculative : committed,
    });
    useLayoutEffect(() => {
      api = controller;
    });
    if (reordered) throw pending;
    return createElement('pager', { selected: controller.focusedName });
  }
  function Parent() {
    const [reordered, setReordered] = useState(false);
    update = setReordered;
    return createElement(
      Suspense,
      { fallback: null },
      createElement(Pager, { reordered }),
    );
  }
  let root: ReturnType<typeof createRoot> | undefined;
  await rendererAct(async () => {
    root = createRoot(document.createElement('div'));
    root.render(createElement(Parent));
  });
  await rendererAct(async () => {
    startTransition(() => update(true));
  });
  expect(api?.getCurrentIndex()).toBe(0);
  expect(api?.getFocusedTab()).toBe('A');
  await rendererAct(async () => {
    api?.jumpToTab('C', false);
  });
  expect(commands.setPageWithoutAnimation).toHaveBeenCalledWith(2);
  await rendererAct(async () => {
    api?.selectIndex(1);
  });
  expect(committed).toHaveBeenCalledWith(
    expect.objectContaining({ tabName: 'B' }),
  );
  expect(speculative).not.toHaveBeenCalled();
  await rendererAct(async () => {
    root?.unmount();
  });
});

it.each([false, true])(
  'reconciles structure before child layout commands (commitOnCommand=%s)',
  async (commitOnCommand) => {
    const commands = { setPage: jest.fn(), setPageWithoutAnimation: jest.fn() };
    const pagerRef = { current: commands };
    function Child({ jump }: { jump: () => void }) {
      useLayoutEffect(jump, [jump]);
      return null;
    }
    let api: ReturnType<typeof useAppPagerController> | undefined;
    function Pager({ reordered }: { reordered: boolean }) {
      const controller = useAppPagerController({
        pages: reordered ? [c, b, a] : [a, b, c],
        pagerRef,
        commitOnCommand,
      });
      api = controller;
      return createElement(Child, {
        jump: () => controller.jumpToTab('C', false),
      });
    }
    let root: ReturnType<typeof createRoot> | undefined;
    await rendererAct(async () => {
      root = createRoot(document.createElement('div'));
      root.render(createElement(Pager, { reordered: false }));
    });
    commands.setPageWithoutAnimation.mockClear();
    await rendererAct(async () => {
      root?.render(createElement(Pager, { reordered: true }));
    });
    expect(commands.setPageWithoutAnimation.mock.calls.at(-1)).toEqual([0]);
    if (!commitOnCommand) {
      await rendererAct(async () => {
        api?.selectIndex(0);
      });
    }
    expect(api?.getCurrentIndex()).toBe(0);
    expect(api?.getFocusedTab()).toBe('C');
    await rendererAct(async () => {
      root?.unmount();
    });
  },
);

it.each(['supersede', 'unmount', 'remove'])(
  'drops an obsolete child layout command after %s',
  async (kind) => {
    const commands = { setPage: jest.fn(), setPageWithoutAnimation: jest.fn() };
    const pagerRef = { current: commands };
    let update: (value: boolean) => void = () => {};
    function Child({ jump }: { jump: () => void }) {
      useLayoutEffect(jump, [jump]);
      return null;
    }
    function Pager({ changed, remove }: { changed: boolean; remove: boolean }) {
      const controller = useAppPagerController({
        pages: remove ? [a, b] : [a, b, c],
        pagerRef,
        commitOnCommand: true,
      });
      const { jumpToTab } = controller;
      useLayoutEffect(() => {
        if (changed && kind === 'supersede') jumpToTab('B', false);
      }, [changed, jumpToTab]);
      const jump = useCallback(() => {
        if (changed && !remove) jumpToTab('C', false);
      }, [changed, remove, jumpToTab]);
      return createElement(Child, { jump });
    }
    function Parent() {
      const [changed, setChanged] = useState(false);
      const [followup, setFollowup] = useState(false);
      update = setChanged;
      useLayoutEffect(() => {
        if (changed && kind !== 'supersede') setFollowup(true);
      }, [changed]);
      return followup && kind === 'unmount'
        ? null
        : createElement(Pager, { changed, remove: followup });
    }
    let root: ReturnType<typeof createRoot> | undefined;
    await rendererAct(async () => {
      root = createRoot(document.createElement('div'));
      root.render(createElement(Parent));
    });
    await rendererAct(async () => {
      update(true);
    });
    expect(commands.setPageWithoutAnimation).not.toHaveBeenCalledWith(2);
    if (kind === 'supersede')
      expect(commands.setPageWithoutAnimation).toHaveBeenLastCalledWith(1);
    await rendererAct(async () => {
      root?.unmount();
    });
  },
);
