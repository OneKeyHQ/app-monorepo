/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import ProfileAvatarButton from './ProfileAvatarButton';

let mockNotificationDot = false;
let mockSupportUnread = 0;
let mockUpdateDot = false;

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
  useIsShowRedDot: () => mockNotificationDot,
  useIsShowAppUpdateDot: () => mockUpdateDot,
}));

jest.mock('../../hooks/useIntercomUnreadCount', () => ({
  useIntercomUnreadCount: () => mockSupportUnread,
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
    mockNotificationDot = false;
    mockSupportUnread = 0;
    mockUpdateDot = false;
  });

  it('shows no mark when nothing waits', () => {
    render(<ProfileAvatarButton />);
    expect(dotColor()).toBeUndefined();
  });

  it('marks unread notifications in red and names them', () => {
    mockNotificationDot = true;
    render(<ProfileAvatarButton />);
    expect(dotColor()).toBe('$bgCriticalStrong');
    expect(
      screen.getByTestId('home-profile-avatar').getAttribute('aria-label'),
    ).toBe('address_book.menu_title, global.notifications');
  });

  it('marks a support reply in red', () => {
    mockSupportUnread = 2;
    render(<ProfileAvatarButton />);
    expect(dotColor()).toBe('$bgCriticalStrong');
  });

  it('marks an update in green only when nothing is unread', () => {
    mockUpdateDot = true;
    const { unmount } = render(<ProfileAvatarButton />);
    expect(dotColor()).toBe('$bgAccent');
    unmount();
    mockNotificationDot = true;
    render(<ProfileAvatarButton />);
    expect(dotColor()).toBe('$bgCriticalStrong');
  });
});
