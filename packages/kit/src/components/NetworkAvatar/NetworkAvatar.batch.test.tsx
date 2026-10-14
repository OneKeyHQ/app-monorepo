/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { NetworkAvatar } from './NetworkAvatar';

const mockGetNetwork = jest.fn(async (_params: unknown) => undefined);
let mockMetadataProvided = false;
let mockNetworks = {};
const mockLoaders: Array<() => Promise<unknown>> = [];
jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Badge: Container,
    Stack: Container,
    Tooltip: Container,
    XStack: Container,
    Icon: () => null,
    Image: ({ src }: { src?: string }) => <img alt="" data-src={src} />,
  };
});
jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceNetwork: { getNetwork: (params: unknown) => mockGetNetwork(params) },
  },
}));
jest.mock('../../hooks/useNetworkLogoUri', () => ({
  useNetworkLogoUri: () => 'fixture-preset-or-cached-logo',
}));
jest.mock('../../hooks/usePromiseResult', () => ({
  usePromiseResult: (method: () => Promise<unknown>) => {
    mockLoaders.push(method);
    return { result: undefined };
  },
}));
jest.mock('../TokenListView/TokenListViewContext', () => ({
  useTokenListViewContext: () => ({
    networksMap: mockNetworks,
    networkMetadataProvided: mockMetadataProvided,
  }),
}));
jest.mock('../LetterAvatar', () => ({ LetterAvatar: () => null }));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isAllNetwork: () => false, isAggregateNetwork: () => false },
}));

beforeEach(() => {
  mockLoaders.length = 0;
  mockGetNetwork.mockClear();
  mockMetadataProvided = false;
  mockNetworks = {};
});

test('a host-owned empty cache keeps logo rendering without per-avatar metadata RPC', async () => {
  mockMetadataProvided = true;
  const view = render(
    <div>
      <NetworkAvatar networkId="evm--1" />
      <NetworkAvatar networkId="evm--1" />
    </div>,
  );
  await Promise.all(mockLoaders.map((method) => method()));
  expect(mockGetNetwork).not.toHaveBeenCalled();
  expect(
    view.container.querySelectorAll(
      'img[data-src="fixture-preset-or-cached-logo"]',
    ),
  ).toHaveLength(2);
});

test('host-owned cached metadata is returned to avatar loaders', async () => {
  mockMetadataProvided = true;
  const network = { id: 'evm--1', logoURI: 'fixture-logo' };
  mockNetworks = { 'evm--1': network };
  render(<NetworkAvatar networkId="evm--1" />);
  expect(await mockLoaders[0]()).toEqual(network);
  expect(mockGetNetwork).not.toHaveBeenCalled();
});

test('avatars outside the scoped cache retain their metadata lookup', async () => {
  render(<NetworkAvatar networkId="evm--1" />);
  await Promise.all(mockLoaders.map((method) => method()));
  expect(mockGetNetwork).toHaveBeenCalledTimes(1);
  expect(mockGetNetwork).toHaveBeenCalledWith({ networkId: 'evm--1' });
});
