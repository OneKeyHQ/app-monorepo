/** @jest-environment jsdom */
import type { ComponentType, PropsWithChildren } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { MobilePerpMarketRoute } from './MobilePerpMarketRoute';

const mockPop = jest.fn();
let resolveDetail: (module: { default: ComponentType }) => void;
const mockPendingDetail = new Promise<{ default: ComponentType }>((resolve) => {
  resolveDetail = resolve;
});

jest.mock('../utils/preloadPerpsMobileMarketPage', () => ({
  loadPerpsMobileMarketPage: () => mockPendingDetail,
}));
jest.mock('../../../hooks/useAppNavigation', () => () => ({ pop: mockPop }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Back' }),
}));
jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: 402, height: 874 }),
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  isNativeIOS26Plus: true,
}));
jest.mock(
  '@onekeyhq/shared/src/modules/DualScreenInfo/isFoldableIPhone',
  () => ({ isFoldableIPhone: () => false }),
);
jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: { global_back: 'global.back' },
}));
jest.mock('@onekeyhq/components', () => {
  const Frame = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    GlassButtonCapsule: Frame,
    Stack: Frame,
    XStack: Frame,
    YStack: Frame,
    Page: {
      Header: ({ headerShown }: { headerShown: boolean }) =>
        headerShown ? <div>Native header</div> : null,
    },
    Spinner: () => <div>Loading</div>,
    NavBackButton: ({ onPress }: { onPress: () => void }) => (
      <button type="button" onClick={onPress}>
        Back
      </button>
    ),
    useIsDesktopModeUIInTabPages: () => false,
    useIsOverlayPage: () => false,
    useIsSplitDetailActive: () => false,
    useMedia: () => ({ md: true }),
    useSafeAreaInsets: () => ({ top: 62 }),
  };
});

it('keeps the same working back button as the lazy route body loads', async () => {
  render(<MobilePerpMarketRoute />);
  expect(screen.getByText('Loading')).toBeTruthy();
  const back = screen.getByRole('button', { name: 'Back' });
  fireEvent.click(back);
  resolveDetail({ default: () => <div>Market detail</div> });
  await screen.findByText('Market detail');
  expect(screen.getByRole('button', { name: 'Back' })).toBe(back);
  fireEvent.click(back);
  expect(mockPop).toHaveBeenCalledTimes(2);
});
