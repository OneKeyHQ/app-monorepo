/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useIntercomUnreadCount } from './useIntercomUnreadCount';

let mockUnread = 0;
const mockListeners = new Set<() => void>();

jest.mock('@onekeyhq/kit/src/views/Intercom/client', () => ({
  getIntercomUnreadCount: () => mockUnread,
  subscribeToIntercomUnreadCount: (listener: () => void) => {
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  },
}));

it('subscribes to unread counts and clears the badge after messages are read', () => {
  const view = renderHook(useIntercomUnreadCount);
  expect(view.result.current).toBe(0);
  act(() => {
    mockUnread = 3;
    mockListeners.forEach((listener) => listener());
  });
  expect(view.result.current).toBe(3);
  act(() => {
    mockUnread = 0;
    mockListeners.forEach((listener) => listener());
  });
  expect(view.result.current).toBe(0);
  view.unmount();
  expect(mockListeners.size).toBe(0);
});
