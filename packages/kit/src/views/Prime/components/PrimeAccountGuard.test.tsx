/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EPrimeGiftPages,
  EPrimePages,
} from '@onekeyhq/shared/src/routes/prime';

import { PrimeGiftRouter, PrimeRouter } from '../router';

import { PrimeAccountGuard } from './PrimeAccountGuard';

let mockIsBanned = true;
const mockPushModal = jest.fn();
const mockLogout = jest.fn();
const mockProtectedMount = jest.fn();
let mockHeaderOptions = { headerShown: false };
const mockHeaderNavigation = {
  setOptions: jest.fn((options: Partial<typeof mockHeaderOptions>) => {
    mockHeaderOptions = { ...mockHeaderOptions, ...options };
  }),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockHeaderNavigation,
}));
jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useOverlayPageScope: () => ({}),
}));
jest.mock('../../../../../components/src/hocs', () => ({
  useIsOverlayPage: () => true,
}));
jest.mock('../../../../../components/src/hooks', () => ({
  useTheme: () => ({ text: { val: '#000' } }),
}));
jest.mock(
  '../../../../../components/src/primitives/Button/GlassHeaderContext',
  () => ({
    toNoGlassHeaderItems: () => undefined,
    wrapHeaderRenderInGlass: (renderHeader: unknown) => renderHeader,
  }),
);
jest.mock(
  '../../../../../components/src/layouts/Navigation/Header/HeaderSearchBar',
  () => () => null,
);
jest.mock('../../../components/LazyLoadPage', () => ({
  LazyLoadPage: () => () => null,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimePersistAtom: () => [{ isOneKeyIdBanned: mockIsBanned }],
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockPushModal }),
}));
jest.mock(
  '@onekeyhq/kit/src/components/OneKeyAuth/useConfirmOneKeyIdLogout',
  () => ({
    useConfirmOneKeyIdLogout: () => mockLogout,
  }),
);
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { PageHeader } = jest.requireActual<
    typeof import('../../../../../components/src/layouts/Page/PageHeader')
  >('../../../../../components/src/layouts/Page/PageHeader');
  function Container({ children }: { children?: ReactNode }) {
    return React.createElement('div', null, children);
  }
  return {
    Page: Object.assign(Container, { Header: PageHeader, Body: Container }),
    YStack: Container,
    SizableText: Container,
    Button: ({
      children,
      onPress,
    }: {
      children: ReactNode;
      onPress: () => void;
    }) => React.createElement('button', { onClick: onPress }, children),
    resetPrimeModal: jest.fn(),
  };
});

function ProtectedContent() {
  mockProtectedMount();
  return <div>Account features</div>;
}

describe('PrimeAccountGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBanned = true;
  });

  it('replaces restricted features before mounting them and keeps deletion available', () => {
    render(
      <PrimeAccountGuard>
        <ProtectedContent />
      </PrimeAccountGuard>,
    );
    expect(mockProtectedMount).not.toHaveBeenCalled();
    expect(
      screen.getByText('error__service_prime_user_banned_error'),
    ).toBeTruthy();
    fireEvent.click(screen.getByText(ETranslations.id_delete_onekey_id));
    expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeDeleteAccount,
    });
    fireEvent.click(screen.getByText(ETranslations.prime_log_out));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  test.each([
    [EModalRoutes.PrimeModal, EPrimePages.PrimeDashboard],
    [EModalRoutes.PrimeModal, EPrimePages.PrimeFeatures],
    [EModalRoutes.PrimeGiftModal, EPrimeGiftPages.PrimeGift],
  ] as const)(
    'restores navigation and deletion from %s/%s',
    (modal, screenName) => {
      const routes =
        modal === EModalRoutes.PrimeModal ? PrimeRouter : PrimeGiftRouter;
      const route = routes.find(({ name }) => name === screenName);
      if (!route?.options || typeof route.options === 'function') {
        throw new OneKeyLocalError(
          'Expected a route with static header options',
        );
      }
      expect(route.options.headerShown).toBe(false);
      mockHeaderOptions = { headerShown: route.options.headerShown ?? true };
      const Component = route.component;

      render(<Component />);

      expect(mockHeaderOptions.headerShown).toBe(true);
      fireEvent.click(screen.getByText(ETranslations.id_delete_onekey_id));
      expect(mockPushModal).toHaveBeenCalledWith(EModalRoutes.PrimeModal, {
        screen: EPrimePages.PrimeDeleteAccount,
      });
      expect(
        PrimeRouter.some(({ name }) => name === EPrimePages.PrimeDeleteAccount),
      ).toBe(true);
    },
  );

  it('renders normal users and responds to an identity change', () => {
    mockIsBanned = false;
    const view = render(
      <PrimeAccountGuard>
        <ProtectedContent />
      </PrimeAccountGuard>,
    );
    expect(screen.getByText('Account features')).toBeTruthy();
    mockIsBanned = true;
    view.rerender(
      <PrimeAccountGuard>
        <ProtectedContent />
      </PrimeAccountGuard>,
    );
    expect(screen.queryByText('Account features')).toBeNull();
    mockIsBanned = false;
    view.rerender(
      <PrimeAccountGuard>
        <ProtectedContent />
      </PrimeAccountGuard>,
    );
    expect(screen.getByText('Account features')).toBeTruthy();
  });
});
