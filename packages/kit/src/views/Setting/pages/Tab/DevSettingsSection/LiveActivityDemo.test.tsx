/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { LiveActivityDemo } from './LiveActivityDemo';

type IStatus = {
  enabled: boolean;
  activities: { id: string; state: string; progress: number }[];
};

const mockGetStatus = jest.fn<Promise<IStatus>, []>();
const mockStart = jest.fn<Promise<IStatus>, []>();
const mockUpdate = jest.fn<Promise<IStatus>, [string]>();
const mockEnd = jest.fn<Promise<IStatus>, []>();
let mockOnAppState: (state: string) => void;

jest.mock('react-native', () => ({
  NativeModules: {
    LiveActivityDemo: {
      getStatus: () => mockGetStatus(),
      start: () => mockStart(),
      update: (id: string) => mockUpdate(id),
      end: () => mockEnd(),
    },
  },
  AppState: {
    addEventListener: (_: string, callback: (state: string) => void) => {
      mockOnAppState = callback;
      return { remove: jest.fn() };
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: { children: ReactNode }) =>
    React.createElement('div', null, children);
  return {
    XStack: Container,
    YStack: Container,
    SizableText: Container,
    Button: ({
      children,
      disabled,
      onPress,
    }: {
      children: ReactNode;
      disabled: boolean;
      onPress: () => Promise<void>;
    }) =>
      React.createElement('button', { disabled, onClick: onPress }, children),
  };
});

const empty: IStatus = { enabled: true, activities: [] };
const running: IStatus = {
  enabled: true,
  activities: [{ id: 'system-activity-id', state: 'active', progress: 0 }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetStatus.mockResolvedValue(empty);
  mockStart.mockResolvedValue(running);
  mockUpdate.mockResolvedValue({
    ...running,
    activities: [{ ...running.activities[0], progress: 25 }],
  });
  mockEnd.mockResolvedValue(empty);
});

it('uses the system activity ID and resynchronizes after dismissal outside the app', async () => {
  render(<LiveActivityDemo />);
  const start = screen.getByRole('button', { name: 'Start demo' });
  await waitFor(() => expect(start).toHaveProperty('disabled', false));
  fireEvent.click(start);
  await screen.findByText(/active · 0%/);
  expect(start).toHaveProperty('disabled', true);
  fireEvent.click(screen.getByRole('button', { name: 'Update +25%' }));
  await screen.findByText(/active · 25%/);
  expect(mockUpdate).toHaveBeenCalledWith('system-activity-id');

  await act(async () => mockOnAppState('active'));
  await waitFor(() => expect(start).toHaveProperty('disabled', false));
  expect(screen.queryByText(/system-activity-id/)).toBeNull();
  expect(screen.getByRole('button', { name: 'End demo' })).toHaveProperty(
    'disabled',
    true,
  );
});

it('blocks duplicate starts and recovers from a native failure through status refresh', async () => {
  let rejectStart: (error: Error) => void = () => undefined;
  mockStart.mockImplementation(
    () =>
      new Promise((_, reject) => {
        rejectStart = reject;
      }),
  );
  render(<LiveActivityDemo />);
  const start = screen.getByRole('button', { name: 'Start demo' });
  await waitFor(() => expect(start).toHaveProperty('disabled', false));
  fireEvent.click(start);
  fireEvent.click(start);
  expect(mockStart).toHaveBeenCalledTimes(1);
  await act(async () => rejectStart(new Error('Live Activities disabled')));
  await screen.findByText('Live Activities disabled');
  expect(start).toHaveProperty('disabled', true);
  mockGetStatus.mockResolvedValue(running);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh status' }));
  await screen.findByText(/active · 0%/);
  fireEvent.click(screen.getByRole('button', { name: 'End demo' }));
  await waitFor(() => expect(start).toHaveProperty('disabled', false));
  expect(mockEnd).toHaveBeenCalledTimes(1);
});
