/** @jest-environment jsdom */

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

it('releases lock entries when the lock host unmounts', () => {
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
  expect(unavailable).toHaveBeenCalledTimes(1);
  render(<ImperativeOverlayMountHost target="lock" />);
  expect(screen.queryByText('Unlock')).toBeNull();
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
