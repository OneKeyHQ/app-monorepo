/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import ProfileAvatarButton from './ProfileAvatarButton';

let mockReasons: string[] = [];

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => ({
  Stack: ({
    children,
    testID,
    bg,
    'aria-label': ariaLabel,
  }: {
    children?: ReactNode;
    testID?: string;
    bg?: string;
    'aria-label'?: string;
  }) => (
    <div data-testid={testID ?? 'dot'} data-bg={bg} aria-label={ariaLabel}>
      {children}
    </div>
  ),
}));

jest.mock('../MoreActionButton', () => ({
  MoreActionProvider: ({ children }: { children?: ReactNode }) => children,
  HomeFirmwareUpdateDetectHost: () => null,
  useWalletMetaSilentRepair: () => undefined,
}));

jest.mock('./useProfileDrawerMarks', () => ({
  useProfileDrawerMarks: () => ({ avatarReasons: mockReasons }),
}));

jest.mock('../OneKeyIdAvatar', () => ({
  OneKeyIdAvatar: () => <span />,
}));

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: ({ children }: { children?: ReactNode }) => children },
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));

jest.mock('./profileDrawerStore', () => ({
  openProfileDrawer: jest.fn(),
  profileDrawerProgress: { value: 0 },
}));

function dotColor() {
  return screen.queryByTestId('dot')?.getAttribute('data-bg');
}

describe('ProfileAvatarButton', () => {
  beforeEach(() => {
    mockReasons = [];
  });

  it('shows no mark when nothing is new', () => {
    render(<ProfileAvatarButton />);
    expect(dotColor()).toBeUndefined();
  });

  it('marks new notifications in red and names them', () => {
    mockReasons = ['notifications'];
    render(<ProfileAvatarButton />);
    expect(dotColor()).toBe('$bgCriticalStrong');
    expect(
      screen.getByTestId('home-profile-avatar').getAttribute('aria-label'),
    ).toBe('address_book.menu_title, global.notifications');
  });

  it('marks a new firmware version in the same red and names it', () => {
    mockReasons = ['support', 'firmware'];
    render(<ProfileAvatarButton />);
    expect(dotColor()).toBe('$bgCriticalStrong');
    expect(
      screen.getByTestId('home-profile-avatar').getAttribute('aria-label'),
    ).toBe(
      'address_book.menu_title, settings.contact_us, update.firmware_available',
    );
  });
});
