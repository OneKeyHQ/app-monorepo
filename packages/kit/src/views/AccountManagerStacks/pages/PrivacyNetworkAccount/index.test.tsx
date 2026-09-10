/** @jest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';

import PrivacyNetworkAccount from '.';

import { render, screen } from '@testing-library/react';

import { EAccountManagerStacksRoutes } from '@onekeyhq/shared/src/routes/accountManagerStacks';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Page: Object.assign(Container, { Header: () => null, Body: Container }),
    ScrollView: Container,
    SizableText: Container,
    YStack: Container,
  };
});

jest.mock(
  '@onekeyhq/kit/src/views/AssetDetails/pages/TokenDetails/LocalWalletAccountPanel',
  () => {
    const { usePrivacyChainPoolDisplayAtom } = jest.requireActual<
      typeof import('@onekeyhq/kit/src/states/jotai/contexts/privacyChainPool')
    >('@onekeyhq/kit/src/states/jotai/contexts/privacyChainPool');
    return {
      LocalWalletAccountPanel: function PoolStoreConsumer() {
        const [display] = usePrivacyChainPoolDisplayAtom();
        return (
          <div data-testid="pool-store">{display?.ownerKey ?? 'ready'}</div>
        );
      },
    };
  },
);

it('opens as a standalone modal without inheriting the Token Details pool provider', () => {
  render(
    <PrivacyNetworkAccount
      navigation={
        {} as ComponentProps<typeof PrivacyNetworkAccount>['navigation']
      }
      route={{
        key: 'privacy-settings',
        name: EAccountManagerStacksRoutes.PrivacyNetworkAccount,
        params: {
          accountId: 'test-account',
          accountName: 'Zcash',
          networkId: 'zec--0',
        },
      }}
    />,
  );
  expect(screen.getByTestId('pool-store').textContent).toBe('ready');
});
