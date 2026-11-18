/** @jest-environment jsdom */

import type { ComponentType, PropsWithChildren } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { openGuideUrl } from './perpGuideData';
import { PerpGuidePopover } from './PerpGuidePopover';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('../../PerpsProviderMirror', () => ({
  PerpsProviderMirror:
    jest.requireActual<typeof import('react')>('react').Fragment,
}));

jest.mock('./perpGuideData', () => ({
  PERP_GUIDE_CATEGORIES: [],
  openGuideUrl: jest.fn(),
}));

jest.mock('@onekeyhq/components', () => {
  const Stack = ({ children }: PropsWithChildren) => <>{children}</>;
  const { TextInput } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const closePopover = jest.fn();

  return {
    IconButton: () => null,
    ScrollView: Stack,
    YStack: Stack,
    SearchBar: TextInput,
    Popover: ({
      renderContent: Content,
    }: {
      renderContent: ComponentType<{ closePopover: () => void }>;
    }) => <Content closePopover={closePopover} />,
  };
});

it('keeps the focused guide query across parent renders and submits it once', async () => {
  const { rerender } = render(<PerpGuidePopover />);
  const input = screen.getByRole('textbox');
  const query = '合约';
  input.focus();
  fireEvent.change(input, { target: { value: query } });

  rerender(<PerpGuidePopover />);

  expect(screen.getByDisplayValue(query)).toBe(input);
  expect(document.activeElement).toBe(input);
  fireEvent.keyDown(input, { key: 'Enter' });

  await waitFor(() => expect(openGuideUrl).toHaveBeenCalledTimes(1));
  expect(openGuideUrl).toHaveBeenCalledWith(
    `https://help.onekey.so?q=${encodeURIComponent(query)}`,
  );
});
