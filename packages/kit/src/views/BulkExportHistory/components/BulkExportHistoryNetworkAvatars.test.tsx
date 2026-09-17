/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import type { IServerNetwork } from '@onekeyhq/shared/types';

import BulkExportHistoryNetworkAvatars from './BulkExportHistoryNetworkAvatars';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function Layout({
    children,
    position,
    zIndex,
  }: {
    children?: ReactNode;
    position?: string;
    zIndex?: number;
  }) {
    return (
      <div data-position={position} data-z-index={zIndex}>
        {children}
      </div>
    );
  }

  return {
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Spinner: () => <div data-testid="spinner" />,
    Stack: Layout,
    XStack: Layout,
  };
});

jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({
  NetworkAvatarBase: ({ networkName }: { networkName?: string }) => (
    <div data-testid={`network-avatar-${networkName ?? 'unknown'}`} />
  ),
}));

jest.mock(
  '@onekeyhq/kit/src/views/ChainSelector/hooks/useNetworkOptions',
  () => ({
    useNetworkOptions: () => ({ networks: [], isLoading: false }),
  }),
);

const networks = [
  { id: 'btc', name: 'Bitcoin', logoURI: 'btc.png' },
  { id: 'eth', name: 'Ethereum', logoURI: 'eth.png' },
  { id: 'bsc', name: 'BNB Smart Chain', logoURI: 'bsc.png' },
] as IServerNetwork[];

const networkIds = [
  'btc',
  'eth',
  'bsc',
  'sol',
  'sui',
  'aptos',
  'base',
  'polygon',
  'arbitrum',
  'optimism',
];

describe('BulkExportHistoryNetworkAvatars', () => {
  it('keeps the inline remaining count behind all visible avatars', () => {
    render(
      <BulkExportHistoryNetworkAvatars
        networkIds={networkIds}
        networkOptions={{ networks, isLoading: false }}
      />,
    );

    const avatarLayers = networks.map(
      (network) =>
        screen.getByTestId(`network-avatar-${network.name}`).parentElement
          ?.dataset.zIndex,
    );
    const remainingCountLayer =
      screen.getByText('+7').parentElement?.dataset.zIndex;

    expect(avatarLayers).toEqual(['3', '2', '1']);
    expect(remainingCountLayer).toBe('0');
  });

  it('keeps the overlay remaining count above the visible avatar', () => {
    render(
      <BulkExportHistoryNetworkAvatars
        networkIds={networkIds}
        networkOptions={{ networks, isLoading: false }}
        maxVisible={1}
        remainingCountMode="overlay"
      />,
    );

    const avatarLayer = screen.getByTestId('network-avatar-Bitcoin')
      .parentElement?.dataset.zIndex;
    const remainingCountLayer =
      screen.getByText('+9').parentElement?.dataset.zIndex;

    expect(avatarLayer).toBe('1');
    expect(remainingCountLayer).toBe('999');
  });
});
