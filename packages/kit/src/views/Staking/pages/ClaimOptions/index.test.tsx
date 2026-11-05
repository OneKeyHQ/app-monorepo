/** @jest-environment jsdom */

import ClaimOptions from '.';

import { fireEvent, render, waitFor } from '@testing-library/react';

const mockClaim = jest.fn<Promise<void>, [unknown]>();
const mockAddTracking = jest.fn<Promise<void>, [unknown]>();
const mockRecord = jest.fn<Promise<void>, [unknown]>();
const mockPop = jest.fn();

jest.mock('@onekeyhq/components', () => {
  const Page = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  Page.Header = () => null;
  Page.Body = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return { Page };
});
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => ({
    params: {
      accountId: 'account',
      networkId: 'btc--0',
      symbol: 'BTC',
      provider: 'babylon',
    },
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pop: mockPop }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: {
      items: [{ id: 'request-1', amount: '1' }],
      token: {},
      network: {},
    },
    isLoading: false,
    run: jest.fn(),
  }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      addBabylonTrackingItem: (value: unknown) => mockAddTracking(value),
      babylonClaimRecord: (value: unknown) => mockRecord(value),
    },
  },
}));
jest.mock('../../hooks/useUniversalHooks', () => ({
  useUniversalClaim: () => mockClaim,
}));
jest.mock('../../components/OptionList', () => ({
  OptionList: ({ onPress }: { onPress: (value: unknown) => void }) => (
    <button onClick={() => onPress({ item: { id: 'request-1', amount: '1' } })}>
      Select
    </button>
  ),
}));
jest.mock('../../components/PageFrame', () => ({
  PageFrame: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SimpleSpinnerSkeleton: () => null,
  isErrorState: () => false,
  isLoadingState: () => false,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { staking: { page: { unstaking: jest.fn() } } },
}));

test('retains a Babylon claim fact after its options page unmounts', async () => {
  mockClaim.mockReset().mockResolvedValue();
  mockAddTracking.mockReset().mockResolvedValue();
  mockRecord.mockReset().mockResolvedValue();
  mockPop.mockReset();
  const screen = render(<ClaimOptions />);
  fireEvent.click(screen.getByRole('button', { name: 'Select' }));
  await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(1));
  const params = mockClaim.mock.calls[0][0] as {
    onSubmitted: (
      txid: string,
      accountAddress: string,
      accountPublicKey: string,
    ) => Promise<void>;
  };
  screen.unmount();
  await params.onSubmitted('broadcast-tx', 'original-address', '02abcd');
  expect(mockAddTracking).toHaveBeenCalledWith(
    expect.objectContaining({
      txId: 'request-1',
      action: 'claim',
      accountId: 'account',
      networkId: 'btc--0',
    }),
  );
  await waitFor(() =>
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: 'request-1',
        expectedAccountAddress: 'original-address',
        expectedAccountPublicKey: '02abcd',
      }),
    ),
  );
  expect(mockPop).not.toHaveBeenCalled();
});
