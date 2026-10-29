/* eslint-disable import/first */

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const Page = Object.assign(Passthrough, {
    Body: Passthrough,
    Header: () => null,
  });
  const media = { gtMd: false };
  (
    globalThis as unknown as {
      __borrowTokenSelectMediaMock: typeof media;
    }
  ).__borrowTokenSelectMediaMock = media;

  return {
    Page,
    Stack: () => null,
    useMedia: () => media,
    useSafeAreaInsets: () => ({ bottom: 0 }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getBorrowAssetsList: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => {
  const navigation = {
    pop: jest.fn(),
    push: jest.fn(),
    pushModal: jest.fn(),
  };
  (
    globalThis as unknown as {
      __borrowTokenSelectNavigationMock: typeof navigation;
    }
  ).__borrowTokenSelectNavigationMock = navigation;

  return {
    __esModule: true,
    default: () => navigation,
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => {
  const route: { current?: unknown } = {};
  (
    globalThis as unknown as {
      __borrowTokenSelectRouteMock: { current?: unknown };
    }
  ).__borrowTokenSelectRouteMock = route;
  return {
    useAppRoute: () => route.current,
  };
});

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const state: { assets: unknown[]; isLoading?: boolean } = { assets: [] };
  (
    globalThis as unknown as {
      __borrowTokenSelectPromiseResultMock: {
        assets: unknown[];
        isLoading?: boolean;
      };
    }
  ).__borrowTokenSelectPromiseResultMock = state;
  return {
    usePromiseResult: () => ({
      result: { assets: state.assets },
      isLoading: state.isLoading,
    }),
  };
});

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy(
    {},
    {
      get: (_target, property) => property,
    },
  ),
}));

jest.mock('../../components/borrowRepayPosition.utils', () => ({
  filterUnsupportedAaveNativeReserveAssets: ({
    assets,
  }: {
    assets?: unknown[];
  }) => assets ?? [],
}));

jest.mock('../../components/BorrowTableList', () => {
  const state: { current?: unknown } = {};
  (
    globalThis as unknown as {
      __borrowTokenSelectListMock: { current?: unknown };
    }
  ).__borrowTokenSelectListMock = state;

  return {
    AmountField: () => null,
    AssetField: () => null,
    AssetWithAmountField: () => null,
    BorrowAPYField: () => null,
    BorrowTableList: (props: unknown) => {
      state.current = props;
      return null;
    },
  };
});

import { act, render } from '@testing-library/react-native';

import {
  EModalStakingRoutes,
  type IModalStakingParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EManagePositionType,
  type IBorrowAsset,
  type IEarnText,
} from '@onekeyhq/shared/types/staking';

import BorrowTokenSelectModal from './BorrowTokenSelectModal';

type ITokenSelectRoute = {
  params: IModalStakingParamList[EModalStakingRoutes.BorrowTokenSelect];
};

type IListProps = {
  isLoading: boolean;
  onPressRow: (item: IBorrowAsset) => void;
  columns: {
    label: string;
    render: (item: IBorrowAsset) => {
      props: {
        balance?: IBorrowAsset['available'];
        amount?: IEarnText;
        amountDescription?: IEarnText;
        title?: IEarnText;
        description?: IEarnText;
      };
    };
  }[];
};

const navigationMock = (
  globalThis as unknown as {
    __borrowTokenSelectNavigationMock: {
      pop: jest.Mock;
      push: jest.Mock;
      pushModal: jest.Mock;
    };
  }
).__borrowTokenSelectNavigationMock;
const routeMock = (
  globalThis as unknown as {
    __borrowTokenSelectRouteMock: { current?: ITokenSelectRoute };
  }
).__borrowTokenSelectRouteMock;
const promiseResultMock = (
  globalThis as unknown as {
    __borrowTokenSelectPromiseResultMock: {
      assets: IBorrowAsset[];
      isLoading?: boolean;
    };
  }
).__borrowTokenSelectPromiseResultMock;
const mediaMock = (
  globalThis as unknown as {
    __borrowTokenSelectMediaMock: { gtMd: boolean };
  }
).__borrowTokenSelectMediaMock;
const listMock = (
  globalThis as unknown as {
    __borrowTokenSelectListMock: { current?: IListProps };
  }
).__borrowTokenSelectListMock;

const asset = {
  reserveAddress: '0xReserve',
  token: {
    address: '0xToken',
    logoURI: 'https://example.com/usdc.png',
    name: 'USD Coin',
    symbol: 'USDC',
  },
} as IBorrowAsset;

const baseParams = {
  accountId: 'earn-account',
  indexedAccountId: 'indexed-account-id',
  networkId: 'evm--1',
  provider: 'aave',
  marketAddress: '0xMarket',
  action: 'supply',
} as const;

function pressAsset() {
  act(() => {
    listMock.current?.onPressRow(asset);
  });
}

describe('BorrowTokenSelectModal selection navigation', () => {
  beforeEach(() => {
    listMock.current = undefined;
    navigationMock.pop.mockReset();
    navigationMock.push.mockReset();
    navigationMock.pushModal.mockReset();
    promiseResultMock.assets = [asset];
    promiseResultMock.isLoading = false;
    mediaMock.gtMd = false;
  });

  it.each(['borrow', 'supply'] as const)(
    'shows loading before the first uncached %s request and empty after it settles',
    (action) => {
      routeMock.current = { params: { ...baseParams, action } };
      promiseResultMock.assets = [];
      promiseResultMock.isLoading = undefined;

      const view = render(<BorrowTokenSelectModal />);
      expect(listMock.current?.isLoading).toBe(true);

      promiseResultMock.isLoading = false;
      view.rerender(<BorrowTokenSelectModal />);
      expect(listMock.current?.isLoading).toBe(false);
    },
  );

  it('immediately pushes Manage Position on the current StakingModal stack', () => {
    routeMock.current = {
      params: {
        ...baseParams,
        navigateOnSelect: {
          screen: EModalStakingRoutes.BorrowManagePosition,
          params: {
            providerLogoURI: 'https://example.com/aave.png',
            type: EManagePositionType.Supply,
          },
        },
      },
    };

    render(<BorrowTokenSelectModal />);
    pressAsset();

    expect(navigationMock.push).toHaveBeenCalledWith(
      EModalStakingRoutes.BorrowManagePosition,
      {
        accountId: 'earn-account',
        indexedAccountId: 'indexed-account-id',
        networkId: 'evm--1',
        provider: 'aave',
        marketAddress: '0xMarket',
        reserveAddress: '0xReserve',
        symbol: 'USDC',
        logoURI: 'https://example.com/usdc.png',
        providerLogoURI: 'https://example.com/aave.png',
        type: EManagePositionType.Supply,
      },
    );
    expect(navigationMock.pushModal).not.toHaveBeenCalled();
    expect(navigationMock.pop).not.toHaveBeenCalled();
  });

  it('returns to Manage Position when the current asset is selected again', () => {
    const onSelect = jest.fn();
    routeMock.current = {
      params: {
        ...baseParams,
        currentReserveAddress: asset.reserveAddress,
        onSelect,
      },
    };

    render(<BorrowTokenSelectModal />);
    pressAsset();

    expect(onSelect).toHaveBeenCalledWith(asset);
    expect(navigationMock.pop).toHaveBeenCalledTimes(1);
    expect(navigationMock.push).not.toHaveBeenCalled();
  });

  it.each([
    ['mobile', false, 0, 'global_asset / global_balance'],
    ['desktop', true, 1, 'global_balance'],
  ] as const)(
    'renders a borrow asset balance from the available API field on %s',
    (_platform, gtMd, balanceColumnIndex, expectedLabel) => {
      const borrowAsset = {
        ...asset,
        available: {
          number: '1.25',
          fiatValue: '2500',
          title: { text: '1.25' },
          description: { text: '$2,500' },
        },
      } as IBorrowAsset;
      mediaMock.gtMd = gtMd;
      promiseResultMock.assets = [borrowAsset];
      routeMock.current = {
        params: {
          ...baseParams,
          action: 'borrow',
        },
      };

      render(<BorrowTokenSelectModal />);

      const balanceCell =
        listMock.current?.columns[balanceColumnIndex]?.render(borrowAsset);
      expect(listMock.current?.columns[balanceColumnIndex]?.label).toBe(
        expectedLabel,
      );
      expect(balanceCell?.props.balance).toEqual(borrowAsset.available);
    },
  );

  it.each([
    ['mobile', false, 0],
    ['desktop', true, 1],
  ] as const)(
    'renders the supply asset-list balance on %s',
    (_platform, gtMd, balanceColumnIndex) => {
      const supplyAsset = {
        ...asset,
        balance: {
          number: '1234.56',
          title: { text: '1234.56' },
          description: { text: '$1,234.56' },
        },
      } as IBorrowAsset;
      mediaMock.gtMd = gtMd;
      promiseResultMock.assets = [supplyAsset];
      routeMock.current = { params: { ...baseParams, action: 'supply' } };

      render(<BorrowTokenSelectModal />);

      const balanceCell =
        listMock.current?.columns[balanceColumnIndex]?.render(supplyAsset);
      expect(balanceCell?.props.balance).toEqual(supplyAsset.balance);
    },
  );
});
