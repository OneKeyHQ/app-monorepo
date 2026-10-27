/** @jest-environment jsdom */

import { useLayoutEffect } from 'react';

import { act, render, screen } from '@testing-library/react';

import {
  ImperativeOverlayMountHost,
  mountImperativeOverlay,
  registerImperativeOverlayPage,
} from './imperativeOverlayMount';

const page = { hostKey: 'main', ownerKey: 'perp' };

it('waits for the source page binding and keeps that binding through page removal', () => {
  render(<ImperativeOverlayMountHost target="page" />);
  let handle!: ReturnType<typeof mountImperativeOverlay>;
  act(() => {
    handle = mountImperativeOverlay({
      target: 'page',
      page,
      node: <span>Deposit</span>,
    });
  });
  expect(screen.queryByText('Deposit')).toBeNull();

  let binding!: ReturnType<typeof registerImperativeOverlayPage>;
  act(() => {
    binding = registerImperativeOverlayPage(page, (node) => (
      <div data-testid="source-page">{node}</div>
    ));
  });
  expect(screen.getByTestId('source-page').textContent).toBe('Deposit');

  act(() => binding.unregister());
  expect(screen.getByTestId('source-page').textContent).toBe('Deposit');
  act(() => handle.destroy());
  expect(screen.queryByText('Deposit')).toBeNull();
});

it('updates the context wrapper without replacing a mounted entry', () => {
  const binding = registerImperativeOverlayPage(page, (node) => (
    <div data-testid="source-page">first:{node}</div>
  ));
  render(<ImperativeOverlayMountHost target="page" />);
  let handle!: ReturnType<typeof mountImperativeOverlay>;
  act(() => {
    handle = mountImperativeOverlay({
      target: 'page',
      page,
      node: <span>Deposit</span>,
    });
  });
  expect(screen.getByTestId('source-page').textContent).toBe('first:Deposit');

  act(() =>
    binding.update((node) => (
      <div data-testid="source-page">second:{node}</div>
    )),
  );
  expect(screen.getByTestId('source-page').textContent).toBe('second:Deposit');
  act(() => handle.destroy());
  act(() => binding.unregister());
});

it('cancels an unmounted page request on page removal', () => {
  const pendingPage = { hostKey: 'main', ownerKey: 'pending' };
  const unavailable = jest.fn();
  const handle = mountImperativeOverlay({
    target: 'page',
    page: pendingPage,
    node: <span>Deposit</span>,
    onPageUnavailable: unavailable,
  });
  const binding = registerImperativeOverlayPage(pendingPage, (node) => node);
  binding.unregister();
  expect(unavailable).toHaveBeenCalledTimes(1);
  handle.destroy();
});

it('keeps a new page binding when an older registration cleans up', () => {
  const older = registerImperativeOverlayPage(page, (node) => node);
  const newer = registerImperativeOverlayPage(page, (node) => node);
  older.unregister();
  render(<ImperativeOverlayMountHost target="page" />);
  let handle!: ReturnType<typeof mountImperativeOverlay>;
  act(() => {
    handle = mountImperativeOverlay({
      target: 'page',
      page,
      node: <span>Deposit</span>,
    });
  });
  expect(screen.getByText('Deposit')).toBeTruthy();
  act(() => handle.destroy());
  act(() => newer.unregister());
});

it('never treats an incomplete page request as a global overlay', () => {
  expect(() =>
    mountImperativeOverlay({
      target: 'page',
      node: <span>Deposit</span>,
    }),
  ).toThrow('source host and owner');
});

it('waits for the first lock host before showing a request', () => {
  const unavailable = jest.fn();
  const handle = mountImperativeOverlay({
    target: 'lock',
    node: <span>First lock</span>,
    onHostUnavailable: unavailable,
  });
  const { unmount } = render(<ImperativeOverlayMountHost target="lock" />);
  expect(screen.getByText('First lock')).toBeTruthy();
  expect(unavailable).not.toHaveBeenCalled();
  act(() => handle.destroy());
  unmount();
});

it('releases lock entries when the lock host unmounts', async () => {
  const unavailable = jest.fn();
  const { unmount } = render(<ImperativeOverlayMountHost target="lock" />);
  act(() => {
    mountImperativeOverlay({
      target: 'lock',
      node: <span>Unlock</span>,
      onHostUnavailable: unavailable,
    });
  });
  expect(screen.getByText('Unlock')).toBeTruthy();
  unmount();
  await Promise.resolve();
  expect(unavailable).toHaveBeenCalledTimes(1);
  render(<ImperativeOverlayMountHost target="lock" />);
  expect(screen.queryByText('Unlock')).toBeNull();
});

it('renders an entry once across two hosts and transfers it when the owner leaves', () => {
  const handle = mountImperativeOverlay({
    target: 'global',
    node: <span>One dialog</span>,
  });
  const first = render(<ImperativeOverlayMountHost target="global" />);
  const second = render(<ImperativeOverlayMountHost target="global" />);
  expect(screen.getAllByText('One dialog')).toHaveLength(1);
  first.unmount();
  expect(screen.getAllByText('One dialog')).toHaveLength(1);
  second.unmount();
  const third = render(<ImperativeOverlayMountHost target="global" />);
  expect(screen.getAllByText('One dialog')).toHaveLength(1);
  act(() => handle.destroy());
  third.unmount();
});

it('keeps the owner when a second host leaves first', () => {
  const handle = mountImperativeOverlay({
    target: 'global',
    node: <span>Primary dialog</span>,
  });
  const first = render(<ImperativeOverlayMountHost target="global" />);
  const second = render(<ImperativeOverlayMountHost target="global" />);
  second.unmount();
  expect(screen.getAllByText('Primary dialog')).toHaveLength(1);
  act(() => handle.destroy());
  first.unmount();
});

it('keeps a lock entry until the last of two hosts leaves', async () => {
  const unavailable = jest.fn();
  const handle = mountImperativeOverlay({
    target: 'lock',
    node: <span>Shared lock</span>,
    onHostUnavailable: unavailable,
  });
  const first = render(<ImperativeOverlayMountHost target="lock" />);
  const second = render(<ImperativeOverlayMountHost target="lock" />);
  expect(screen.getAllByText('Shared lock')).toHaveLength(1);
  first.unmount();
  await Promise.resolve();
  expect(screen.getAllByText('Shared lock')).toHaveLength(1);
  expect(unavailable).not.toHaveBeenCalled();
  second.unmount();
  await Promise.resolve();
  expect(unavailable).toHaveBeenCalledTimes(1);
  act(() => handle.destroy());
});

it('cancels a late lock request after host removal without reviving it', async () => {
  const first = render(<ImperativeOverlayMountHost target="lock" />);
  first.unmount();
  const unavailable = jest.fn();
  const handle = mountImperativeOverlay({
    target: 'lock',
    node: <span>Late unlock</span>,
    onHostUnavailable: unavailable,
  });
  await Promise.resolve();
  expect(unavailable).toHaveBeenCalledTimes(1);
  const second = render(<ImperativeOverlayMountHost target="lock" />);
  expect(screen.queryByText('Late unlock')).toBeNull();
  act(() => handle.destroy());
  second.unmount();
  await Promise.resolve();
  expect(unavailable).toHaveBeenCalledTimes(1);
});

it('keeps a lock request when a replacement host mounts in the same commit', async () => {
  const first = render(<ImperativeOverlayMountHost target="lock" />);
  first.unmount();
  const unavailable = jest.fn();
  let handle!: ReturnType<typeof mountImperativeOverlay>;
  function RequestOnLayout() {
    useLayoutEffect(() => {
      handle = mountImperativeOverlay({
        target: 'lock',
        node: <span>Replacement lock</span>,
        onHostUnavailable: unavailable,
      });
      return () => handle.destroy();
    }, []);
    return null;
  }
  const second = render(
    <>
      <RequestOnLayout />
      <ImperativeOverlayMountHost target="lock" />
    </>,
  );
  await Promise.resolve();
  expect(screen.getByText('Replacement lock')).toBeTruthy();
  expect(unavailable).not.toHaveBeenCalled();
  second.unmount();
  await Promise.resolve();
});

it('does not notify a late lock request destroyed before its cancellation', async () => {
  const first = render(<ImperativeOverlayMountHost target="lock" />);
  first.unmount();
  const unavailable = jest.fn();
  const handle = mountImperativeOverlay({
    target: 'lock',
    node: <span>Cancelled lock</span>,
    onHostUnavailable: unavailable,
  });
  act(() => handle.destroy());
  await Promise.resolve();
  expect(unavailable).not.toHaveBeenCalled();
  const second = render(<ImperativeOverlayMountHost target="lock" />);
  expect(screen.queryByText('Cancelled lock')).toBeNull();
  second.unmount();
  await Promise.resolve();
});

it('cancels a late request from a removed page without reviving it', async () => {
  const binding = registerImperativeOverlayPage(page, (node) => node);
  binding.unregister();
  const unavailable = jest.fn();
  const handle = mountImperativeOverlay({
    target: 'page',
    page,
    node: <span>Late deposit</span>,
    onPageUnavailable: unavailable,
  });
  render(<ImperativeOverlayMountHost target="page" />);
  expect(screen.queryByText('Late deposit')).toBeNull();
  await Promise.resolve();
  expect(unavailable).toHaveBeenCalledTimes(1);
  act(() => handle.destroy());
});
