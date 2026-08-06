/* eslint-disable import/first */

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  const media = { gtMd: false };
  (
    globalThis as unknown as {
      __borrowCardMediaMock: typeof media;
    }
  ).__borrowCardMediaMock = media;

  return {
    useMedia: () => media,
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy(
    {},
    {
      get: (_target, property) => property,
    },
  ),
}));

jest.mock('../../Staking/pages/ManagePosition/hooks/useManagePage', () => ({
  EManagePositionType: { Borrow: 'borrow' },
}));

jest.mock('../borrowDataStatus', () => ({
  isBorrowReservesPending: () => false,
}));

jest.mock('../BorrowProvider', () => {
  const state: { current?: unknown } = {};
  (
    globalThis as unknown as {
      __borrowCardContextMock: typeof state;
    }
  ).__borrowCardContextMock = state;

  return {
    useBorrowContext: () => state.current,
  };
});

jest.mock('../borrowUtils', () => ({
  BorrowNavigation: {
    pushToBorrowManagePosition: jest.fn(),
    pushToBorrowReserveDetails: jest.fn(),
  },
}));

jest.mock('./borrowRepayPosition.utils', () => ({
  filterUnsupportedAaveNativeReserveAssets: ({
    assets,
  }: {
    assets?: unknown[];
  }) => assets ?? [],
}));

jest.mock('./collateralControls.utils', () => ({
  isBorrowAssetVisible: () => true,
}));

jest.mock('./Card', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Card: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('./BorrowTableList', () => {
  const state: { current?: unknown } = {};
  (
    globalThis as unknown as {
      __borrowCardListMock: typeof state;
    }
  ).__borrowCardListMock = state;

  const Field = () => null;
  return {
    ActionField: Field,
    AmountField: Field,
    AssetField: Field,
    AssetWithAmountField: Field,
    BorrowAPYField: Field,
    BorrowTableList: (props: unknown) => {
      state.current = props;
      return null;
    },
    BORROW_TABLE_ACTION_COLUMN_COMPACT_WIDTH: 112,
    BORROW_TABLE_AMOUNT_COLUMN_MAX_WIDTH: 160,
    BORROW_TABLE_AMOUNT_COLUMN_MIN_WIDTH: 88,
    BORROW_TABLE_APY_COLUMN_MAX_WIDTH: 104,
    BORROW_TABLE_APY_COLUMN_MIN_WIDTH: 96,
    BORROW_TABLE_ASSET_COLUMN_MIN_WIDTH: 100,
  };
});

import type { ReactElement } from 'react';

import { render } from '@testing-library/react-native';

import type {
  IBorrowReserveItem,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

import { BorrowCard } from './BorrowCard';

type IBorrowAsset = IBorrowReserveItem['borrow']['assets'][number];

type ICellProps = {
  amount?: IEarnText;
  amountDescription?: IEarnText;
  amountLabel?: IEarnText;
  title?: IEarnText;
  description?: IEarnText;
};

type IColumn = {
  key: string;
  label: string;
  comparator?: (a: IBorrowAsset, b: IBorrowAsset) => number | null;
  render: (item: IBorrowAsset) => ReactElement<ICellProps>;
};

type IListProps = {
  columns: IColumn[];
  data: IBorrowAsset[];
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
};

const mediaMock = (
  globalThis as unknown as {
    __borrowCardMediaMock: { gtMd: boolean };
  }
).__borrowCardMediaMock;
const contextMock = (
  globalThis as unknown as {
    __borrowCardContextMock: { current?: unknown };
  }
).__borrowCardContextMock;
const listMock = (
  globalThis as unknown as {
    __borrowCardListMock: { current?: IListProps };
  }
).__borrowCardListMock;

function buildAsset({
  fiatValue,
  amount,
  description,
}: {
  fiatValue: string;
  amount: string;
  description: string;
}): IBorrowAsset {
  return {
    reserveAddress: '0xReserve',
    token: {
      networkId: 'evm--8453',
      address: '0xToken',
      logoURI: 'https://example.com/eth.png',
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    apyDetail: { apy: '2.5' },
    categories: [],
    available: {
      amount,
      fiatValue,
      title: { text: amount },
      description: { text: description },
    },
    borrowButton: {
      type: 'borrow',
      disabled: false,
      text: { text: 'Borrow' },
      data: { balance: amount },
    },
  } as IBorrowAsset;
}

describe('BorrowCard reserve balance presentation', () => {
  const asset = buildAsset({
    fiatValue: '2500',
    amount: '1.25',
    description: '$2,500',
  });

  beforeEach(() => {
    listMock.current = undefined;
    mediaMock.gtMd = false;
    contextMock.current = {
      reserves: {
        data: {
          borrow: {
            assets: [asset],
          },
        },
      },
      market: {
        networkId: 'evm--8453',
        provider: 'aave',
        marketAddress: '0xMarket',
        logoURI: 'https://example.com/aave.png',
      },
      borrowDataStatus: 'ready',
      earnAccount: {
        data: {
          account: {
            id: 'account-id',
            indexedAccountId: 'indexed-account-id',
          },
          walletId: 'wallet-id',
        },
      },
    };
  });

  it.each([
    {
      platform: 'mobile',
      gtMd: false,
      columnIndex: 0,
      expectedLabel: 'global_asset / global_balance',
      amountProp: 'amount',
      descriptionProp: 'amountDescription',
    },
    {
      platform: 'desktop',
      gtMd: true,
      columnIndex: 1,
      expectedLabel: 'global_balance',
      amountProp: 'title',
      descriptionProp: 'description',
    },
  ] as const)(
    'uses the reserve available field for $platform balance display and sorting',
    ({ gtMd, columnIndex, expectedLabel, amountProp, descriptionProp }) => {
      mediaMock.gtMd = gtMd;
      render(<BorrowCard />);

      const props = listMock.current;
      const balanceColumn = props?.columns[columnIndex];
      const renderedCell = balanceColumn?.render(asset);

      expect(props?.data).toEqual([asset]);
      expect(props?.defaultSortKey).toBe('balance');
      expect(props?.defaultSortDirection).toBe('desc');
      expect(balanceColumn?.label).toBe(expectedLabel);
      expect(renderedCell?.props[amountProp]).toEqual(asset.available.title);
      expect(renderedCell?.props[descriptionProp]).toEqual(
        asset.available.description,
      );

      if (gtMd) {
        const comparator = balanceColumn?.comparator;
        const lower = buildAsset({
          fiatValue: '9',
          amount: '9',
          description: '$9',
        });
        const higher = buildAsset({
          fiatValue: '10',
          amount: '10',
          description: '$10',
        });

        expect(comparator?.(lower, higher)).toBeLessThan(0);
        expect(comparator?.(higher, lower)).toBeGreaterThan(0);
      } else {
        expect(renderedCell?.props.amountLabel).toEqual({
          text: 'global_balance:',
        });
      }
    },
  );
});
