import type { IBook } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  calculateRequiredSubscriptions,
  getSubscriptionResumeAction,
  isOrderBookOptionsTargetReady,
  normalizeL2BookForSubscriptionSpec,
} from './SubscriptionConfig';

import type { ISubscriptionSpec } from './SubscriptionConfig';

describe('getSubscriptionResumeAction', () => {
  it('keeps a connecting transport and lets the open handler reconcile', () => {
    expect(
      getSubscriptionResumeAction({
        isOpen: false,
        isClosedOrClosing: false,
      }),
    ).toBe('waitForOpen');
  });

  it('reconciles open transports and reconnects closed transports', () => {
    expect(
      getSubscriptionResumeAction({
        isOpen: true,
        isClosedOrClosing: false,
      }),
    ).toBe('reconcile');
    expect(
      getSubscriptionResumeAction({
        isOpen: false,
        isClosedOrClosing: true,
      }),
    ).toBe('reconnect');
  });
});

describe('isOrderBookOptionsTargetReady', () => {
  it('waits for order book options to catch up with the active coin', () => {
    expect(isOrderBookOptionsTargetReady('ETH', 'BTC')).toBe(false);
    expect(isOrderBookOptionsTargetReady('ETH', 'ETH')).toBe(true);
    expect(isOrderBookOptionsTargetReady('ETH', undefined)).toBe(true);
  });
});

describe('normalizeL2BookForSubscriptionSpec', () => {
  const data: IBook = {
    coin: 'ETH',
    time: 1,
    levels: [[], []],
  };

  it('uses the precision of the active wire subscription', () => {
    const spec = calculateRequiredSubscriptions({
      currentUser: null,
      currentSymbol: 'ETH',
      isConnected: true,
      orderBookTransport: 'l2Book',
      l2BookOptions: { nSigFigs: 5, mantissa: 2 },
    }).find(
      (item) => item.type === ESubscriptionType.L2_BOOK,
    ) as ISubscriptionSpec<ESubscriptionType.L2_BOOK>;

    expect(normalizeL2BookForSubscriptionSpec(data, spec)).toMatchObject({
      coin: 'ETH',
      nSigFigs: 5,
      mantissa: 2,
    });
  });

  it('drops frames when no matching wire subscription is active', () => {
    expect(normalizeL2BookForSubscriptionSpec(data, null)).toBeUndefined();

    const spec = calculateRequiredSubscriptions({
      currentUser: null,
      currentSymbol: 'BTC',
      isConnected: true,
      orderBookTransport: 'l2Book',
      l2BookOptions: { nSigFigs: 5, mantissa: 2 },
    }).find(
      (item) => item.type === ESubscriptionType.L2_BOOK,
    ) as ISubscriptionSpec<ESubscriptionType.L2_BOOK>;

    expect(normalizeL2BookForSubscriptionSpec(data, spec)).toBeUndefined();
  });
});

describe('calculateRequiredSubscriptions', () => {
  it('always subscribes to all dex asset contexts for token selector prices', () => {
    const specs = calculateRequiredSubscriptions({
      currentUser: null,
      currentSymbol: '',
      isConnected: true,
    });

    expect(
      specs.some((spec) => spec.type === ESubscriptionType.ALL_DEXS_ASSET_CTXS),
    ).toBe(true);
  });

  it('subscribes to L2 book when an active market has order book options', () => {
    const specs = calculateRequiredSubscriptions({
      currentUser: null,
      currentSymbol: 'BTC',
      isConnected: true,
      l2BookOptions: {
        nSigFigs: 5,
        mantissa: null,
      },
    });

    expect(
      specs
        .filter((spec) => spec.type === ESubscriptionType.L2_BOOK)
        .map((spec) => spec.params),
    ).toEqual([
      {
        coin: 'BTC',
        nSigFigs: 5,
        mantissa: null,
      },
    ]);
  });

  it('prefers fast L2 for a perp book when explicitly enabled', () => {
    const specs = calculateRequiredSubscriptions({
      currentUser: null,
      currentSymbol: 'BTC',
      isConnected: true,
      orderBookTransport: 'l2',
      l2BookOptions: {
        nSigFigs: 5,
        mantissa: null,
      },
    });

    expect(
      specs
        .filter((spec) => spec.type === ESubscriptionType.L2)
        .map((spec) => spec.params),
    ).toEqual([
      {
        c: 'BTC',
        s: 5,
      },
    ]);
    expect(specs.some((spec) => spec.type === ESubscriptionType.L2_BOOK)).toBe(
      false,
    );
  });

  it('prefers fast L2 for a spot book when explicitly enabled', () => {
    const specs = calculateRequiredSubscriptions({
      currentUser: null,
      currentSymbol: '',
      currentSpotSymbol: '@107',
      tradingMode: 'spot',
      isConnected: true,
      orderBookTransport: 'l2',
      l2BookOptions: {
        nSigFigs: 5,
        mantissa: null,
      },
    });

    expect(
      specs
        .filter((spec) => spec.type === ESubscriptionType.L2)
        .map((spec) => spec.params),
    ).toEqual([
      {
        c: '@107',
        s: 5,
      },
    ]);
    expect(specs.some((spec) => spec.type === ESubscriptionType.L2_BOOK)).toBe(
      false,
    );
  });

  it('uses l2Book when the service selects the fallback transport', () => {
    const specs = calculateRequiredSubscriptions({
      currentUser: null,
      currentSymbol: 'BTC',
      isConnected: true,
      orderBookTransport: 'l2Book',
      l2BookOptions: {
        nSigFigs: 5,
        mantissa: null,
      },
    });

    expect(specs.some((spec) => spec.type === ESubscriptionType.L2)).toBe(
      false,
    );
    expect(
      specs
        .filter((spec) => spec.type === ESubscriptionType.L2_BOOK)
        .map((spec) => spec.params),
    ).toEqual([
      {
        coin: 'BTC',
        nSigFigs: 5,
        mantissa: null,
      },
    ]);
  });

  it('subscribes openOrders to all supported perp dex response channels', () => {
    const specs = calculateRequiredSubscriptions({
      currentUser: '0x0000000000000000000000000000000000000001',
      currentSymbol: 'ETH',
      isConnected: true,
    });

    const openOrdersSpecs = specs.filter(
      (spec) => spec.type === ESubscriptionType.OPEN_ORDERS,
    );

    expect(openOrdersSpecs.map((spec) => spec.params)).toEqual(
      expect.arrayContaining([
        {
          user: '0x0000000000000000000000000000000000000001',
          dex: '',
        },
        {
          user: '0x0000000000000000000000000000000000000001',
          dex: 'xyz',
        },
      ]),
    );
  });

  it('subscribes TWAP states to all supported perp dex response channels', () => {
    const specs = calculateRequiredSubscriptions({
      currentUser: '0x0000000000000000000000000000000000000001',
      currentSymbol: 'ETH',
      isConnected: true,
    });

    const twapStateSpecs = specs.filter(
      (spec) => spec.type === ESubscriptionType.TWAP_STATES,
    );

    expect(twapStateSpecs.map((spec) => spec.params)).toEqual(
      expect.arrayContaining([
        {
          user: '0x0000000000000000000000000000000000000001',
          dex: '',
        },
        {
          user: '0x0000000000000000000000000000000000000001',
          dex: 'xyz',
        },
      ]),
    );
  });

  it('subscribes TWAP history and fills once per connected user', () => {
    const specs = calculateRequiredSubscriptions({
      currentUser: '0x0000000000000000000000000000000000000001',
      currentSymbol: 'ETH',
      isConnected: true,
    });

    expect(
      specs
        .filter((spec) => spec.type === ESubscriptionType.USER_TWAP_HISTORY)
        .map((spec) => spec.params),
    ).toEqual([
      {
        user: '0x0000000000000000000000000000000000000001',
      },
    ]);
    expect(
      specs
        .filter((spec) => spec.type === ESubscriptionType.USER_TWAP_SLICE_FILLS)
        .map((spec) => spec.params),
    ).toEqual([
      {
        user: '0x0000000000000000000000000000000000000001',
      },
    ]);
  });

  it('does not subscribe account TWAP channels without a connected user', () => {
    const specs = calculateRequiredSubscriptions({
      currentUser: null,
      currentSymbol: 'ETH',
      isConnected: true,
    });

    expect(
      specs.some(
        (spec) =>
          spec.type === ESubscriptionType.TWAP_STATES ||
          spec.type === ESubscriptionType.USER_TWAP_HISTORY ||
          spec.type === ESubscriptionType.USER_TWAP_SLICE_FILLS,
      ),
    ).toBe(false);
  });
});
