import { render } from '@testing-library/react-native';

import TokenDetailsView from './TokenDetailsView';

import type { IProps } from '.';

const mockPager = jest.fn<null, [unknown]>(() => null);
const mockHistory = jest.fn<null, [unknown]>(() => null);
jest.mock('./TokenDetailsPager', () => ({
  TokenDetailsPager: (props: unknown) => mockPager(props),
}));
jest.mock('./TokenDetailsHistory', () => ({
  __esModule: true,
  default: (props: unknown) => mockHistory(props),
}));
jest.mock('./TokenDetailsHeader', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('./TokenDetailsContext', () => ({
  useTokenDetailsContext: () => ({ setTokenAccountMap: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/components', () => ({ Empty: () => null }));
jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorCreateAddressButton',
  () => ({
    AccountSelectorCreateAddressButton: () => null,
  }),
);
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
const props = {
  networkId: 'starknet--mainnet',
  tokenInfo: { address: '0x1', symbol: 'STRK' },
  deriveType: 'default',
  deriveInfo: {},
} as IProps;

beforeEach(() => jest.clearAllMocks());

it.each(['watching', 'external'])(
  'opens %s accounts on public history without a private tab',
  (walletId) => {
    render(
      <TokenDetailsView
        {...props}
        walletId={walletId}
        accountId={`${walletId}--starknet--0x1`}
      />,
    );
    expect(mockPager).not.toHaveBeenCalled();
    expect(mockHistory).toHaveBeenCalledWith(
      expect.objectContaining({ starknetPrivacyMode: 'public' }),
    );
  },
);

it.each(['hd-1', 'imported', 'hw-1'])(
  'keeps both tabs for %s accounts',
  (walletId) => {
    render(
      <TokenDetailsView
        {...props}
        walletId={walletId}
        accountId={`${walletId}--starknet--0x1`}
      />,
    );
    expect(mockPager).toHaveBeenCalledWith(
      expect.objectContaining({
        pages: [
          expect.objectContaining({ key: 'public' }),
          expect.objectContaining({ key: 'private' }),
        ],
      }),
    );
  },
);

it('uses ordinary history outside Starknet', () => {
  render(
    <TokenDetailsView
      {...props}
      networkId="aptos--1"
      walletId="watching"
      accountId="watching--aptos--0x1"
    />,
  );
  expect(mockPager).not.toHaveBeenCalled();
  expect(mockHistory).toHaveBeenCalledWith(
    expect.not.objectContaining({ starknetPrivacyMode: expect.anything() }),
  );
});
