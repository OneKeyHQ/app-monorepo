import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';

import {
  formatReceiveArrivalTime,
  getReceiveArrivalTimeText,
  resolveReceiveArrivalSeconds,
} from './receiveArrivalTimeUtils';

const defaultLocale = appLocale.intl.locale;
const defaultMessages = appLocale.intl.messages;

beforeEach(() => {
  appLocale.setLocale('en-US', {
    [ETranslations.receive_arrival_time_sec]: '~{number} s',
    [ETranslations.receive_arrival_time_min]: '~{number} min',
    [ETranslations.receive_arrival_time_over_min]: '> {number} min',
  } as Parameters<typeof appLocale.setLocale>[1]);
});

afterEach(() => {
  appLocale.setLocale(defaultLocale, defaultMessages);
});

describe('resolveReceiveArrivalSeconds', () => {
  it('resolves by impl for family chains', () => {
    expect(resolveReceiveArrivalSeconds({ networkId: 'btc--0' })).toBe(600);
    expect(resolveReceiveArrivalSeconds({ networkId: 'sol--101' })).toBe(30);
    expect(resolveReceiveArrivalSeconds({ networkId: 'neo--3' })).toBe(90);
    expect(resolveReceiveArrivalSeconds({ networkId: 'lightning--0' })).toBe(5);
    expect(
      resolveReceiveArrivalSeconds({ networkId: 'stellar--mainnet' }),
    ).toBe(15);
  });

  it('bundled byNetworkId beats bundled byImpl', () => {
    expect(resolveReceiveArrivalSeconds({ networkId: 'evm--1' })).toBe(300);
    expect(resolveReceiveArrivalSeconds({ networkId: 'evm--137' })).toBe(300);
    expect(resolveReceiveArrivalSeconds({ networkId: 'evm--61' })).toBe(1800);
    // non-overridden EVM chains use the family default
    expect(resolveReceiveArrivalSeconds({ networkId: 'evm--8453' })).toBe(60);
  });

  it('hides unknown impls, testnets and custom networks', () => {
    expect(resolveReceiveArrivalSeconds({ networkId: 'onekeyall--0' })).toBe(
      null,
    );
    expect(resolveReceiveArrivalSeconds({ networkId: 'aggregate--0' })).toBe(
      null,
    );
    expect(resolveReceiveArrivalSeconds({ networkId: 'tbtc--0' })).toBe(null);
    expect(
      resolveReceiveArrivalSeconds({
        networkId: 'evm--11155111',
        isTestnet: true,
      }),
    ).toBe(null);
    expect(
      resolveReceiveArrivalSeconds({
        networkId: 'evm--99999',
        isCustomNetwork: true,
      }),
    ).toBe(null);
    expect(resolveReceiveArrivalSeconds({ networkId: undefined })).toBe(null);
  });

  it('server override byNetworkId wins over everything', () => {
    expect(
      resolveReceiveArrivalSeconds({
        networkId: 'evm--1',
        override: { byNetworkId: { 'evm--1': 120 } },
      }),
    ).toBe(120);
  });

  it('server override byImpl wins over bundled byNetworkId', () => {
    expect(
      resolveReceiveArrivalSeconds({
        networkId: 'evm--1',
        override: { byImpl: { evm: 90 } },
      }),
    ).toBe(90);
  });

  it('server override 0 force-hides', () => {
    expect(
      resolveReceiveArrivalSeconds({
        networkId: 'btc--0',
        override: { byNetworkId: { 'btc--0': 0 } },
      }),
    ).toBe(null);
    expect(
      resolveReceiveArrivalSeconds({
        networkId: 'btc--0',
        override: { byImpl: { btc: 0 } },
      }),
    ).toBe(null);
  });

  it('malformed override values are ignored and fall through', () => {
    expect(
      resolveReceiveArrivalSeconds({
        networkId: 'btc--0',
        override: { byNetworkId: { 'btc--0': -5 } },
      }),
    ).toBe(600);
    expect(
      resolveReceiveArrivalSeconds({
        networkId: 'btc--0',
        override: { byNetworkId: { 'btc--0': 30.5 } },
      }),
    ).toBe(600);
    expect(
      resolveReceiveArrivalSeconds({
        networkId: 'btc--0',
        override: {
          byNetworkId: { 'btc--0': Number.NaN },
          byImpl: { btc: 45 },
        },
      }),
    ).toBe(45);
  });

  it('override on unknown impl can add a new chain', () => {
    expect(
      resolveReceiveArrivalSeconds({
        networkId: 'foo--1',
        override: { byImpl: { foo: 20 } },
      }),
    ).toBe(20);
  });
});

describe('formatReceiveArrivalTime', () => {
  it('hides invalid values', () => {
    expect(formatReceiveArrivalTime({ seconds: undefined })).toBe(undefined);
    expect(formatReceiveArrivalTime({ seconds: null })).toBe(undefined);
    expect(formatReceiveArrivalTime({ seconds: 0 })).toBe(undefined);
    expect(formatReceiveArrivalTime({ seconds: -1 })).toBe(undefined);
    expect(formatReceiveArrivalTime({ seconds: Number.NaN })).toBe(undefined);
    expect(formatReceiveArrivalTime({ seconds: Infinity })).toBe(undefined);
  });

  it('shows seconds under one minute', () => {
    expect(formatReceiveArrivalTime({ seconds: 5 })).toBe('~5 s');
    expect(formatReceiveArrivalTime({ seconds: 30 })).toBe('~30 s');
    expect(formatReceiveArrivalTime({ seconds: 59 })).toBe('~59 s');
  });

  it('shows rounded-up minutes between 1min and 60min', () => {
    expect(formatReceiveArrivalTime({ seconds: 60 })).toBe('~1 min');
    expect(formatReceiveArrivalTime({ seconds: 61 })).toBe('~2 min');
    expect(formatReceiveArrivalTime({ seconds: 144 })).toBe('~3 min');
    expect(formatReceiveArrivalTime({ seconds: 300 })).toBe('~5 min');
    expect(formatReceiveArrivalTime({ seconds: 600 })).toBe('~10 min');
    expect(formatReceiveArrivalTime({ seconds: 601 })).toBe('~11 min');
    expect(formatReceiveArrivalTime({ seconds: 3600 })).toBe('~60 min');
  });

  it('caps display above one hour', () => {
    expect(formatReceiveArrivalTime({ seconds: 3601 })).toBe('> 60 min');
    expect(formatReceiveArrivalTime({ seconds: 86_400 })).toBe('> 60 min');
  });
});

describe('getReceiveArrivalTimeText', () => {
  it('combines resolve + format', () => {
    expect(getReceiveArrivalTimeText({ networkId: 'btc--0' })).toBe('~10 min');
    expect(getReceiveArrivalTimeText({ networkId: 'evm--1' })).toBe('~5 min');
    expect(getReceiveArrivalTimeText({ networkId: 'sol--101' })).toBe('~30 s');
    expect(getReceiveArrivalTimeText({ networkId: 'evm--10001' })).toBe(
      '> 60 min',
    );
    expect(getReceiveArrivalTimeText({ networkId: 'fil--314' })).toBe(
      '~30 min',
    );
    expect(getReceiveArrivalTimeText({ networkId: 'lightning--0' })).toBe(
      '~5 s',
    );
    expect(getReceiveArrivalTimeText({ networkId: 'onekeyall--0' })).toBe(
      undefined,
    );
    expect(
      getReceiveArrivalTimeText({
        networkId: 'evm--11155111',
        isTestnet: true,
      }),
    ).toBe(undefined);
  });
});
