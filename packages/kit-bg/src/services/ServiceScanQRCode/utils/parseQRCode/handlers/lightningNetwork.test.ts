import { AxiosError } from 'axios';
import { bech32 } from 'bech32';

import ServiceLightning from '@onekeyhq/kit-bg/src/services/ServiceLightning';
import ClientLightning from '@onekeyhq/kit-bg/src/vaults/impls/lightning/sdkLightning/ClientLightning';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  InvoiceExpiredError,
  OneKeyError,
  OneKeyLocalError,
  OneKeyServerApiError,
  RetryableLightningScanError,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type { IInvoiceDecodedResponse } from '@onekeyhq/shared/types/lightning';
import {
  EQRCodeHandlerNames,
  EQRCodeHandlerType,
} from '@onekeyhq/shared/types/qrCode';

import { parseQRCode } from '..';

import lightningNetwork from './lightningNetwork';

import type { IQRCodeHandlerOptions } from '../type';
import type { AxiosInstance } from 'axios';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/background/backgroundDecorators')
  >('@onekeyhq/shared/src/background/backgroundDecorators');
  return { ...actual, backgroundClass: () => (target: unknown) => target };
});

// BOLT 11 example invoices (mainnet and testnet) and the LUD-01 example LNURL.
const INVOICE =
  'lnbc1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdpl2pkx2ctnv5sxxmmwwd5kgetjypeh2ursdae8g6twvus8g6rfwvs8qun0dfjkxaq9qrsgq357wnc5r2ueh7ck6q93dj32dlqnls087fxdwk8qakdyafkq3yap9us6v52vjjsrvywa6rt52cm9r9zqt8r2t7mlcwspyetp5h2tztugp9lfyql';
const TESTNET_INVOICE =
  'lntb20m1pvjluezsp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygshp58yjmdan79s6qqdhdzgynm4zwqd5d7xmw5fk98klysy043l2ahrqspp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqfpp3x9et2e20v6pu37c5d9vax37wxq72un989qrsgqdj545axuxtnfemtpwkc45hx9d2ft7x04mt8q7y6t0k2dge9e7h8kpy9p34ytyslj3yu569aalz2xdk8xkd7ltxqld94u8h2esmsmacgpghe9k8';
const LNURL =
  'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns';

function setup() {
  const findAndValidateLnurl = jest.fn(async () => ({
    tag: 'payRequest',
    url: 'https://example.com/pay',
  }));
  const decodedInvoice = jest.fn(
    async (address: string): Promise<IInvoiceDecodedResponse> => ({
      paymentRequest: address,
      tags: [],
      tagsObject: {},
    }),
  );
  const getLnClient = jest.fn(async (_isTestnet: boolean) => ({
    decodedInvoice,
  }));
  const getNetwork = jest.fn(async ({ networkId }: { networkId: string }) => ({
    id: networkId,
  }));
  const options = {
    backgroundApi: {
      serviceNetwork: { getNetwork },
      serviceLightning: { findAndValidateLnurl, getLnClient },
    },
  } as unknown as IQRCodeHandlerOptions;
  return {
    options,
    findAndValidateLnurl,
    getLnClient,
    decodedInvoice,
    getNetwork,
  };
}

function setupRecipientValidation() {
  const { options } = setup();
  const lnurlDetails = { tag: 'payRequest', url: 'https://example.com/pay' };
  const serverValidateAddress = jest.fn(
    async (_params: { networkId: string; address: string }) => ({
      data: { data: { lnurlDetails } },
    }),
  );
  const serviceLightning = new ServiceLightning({
    backgroundApi: { serviceValidator: { serverValidateAddress } },
  });
  const parseOptions = {
    ...options,
    backgroundApi: {
      ...options.backgroundApi,
      serviceLightning,
    } as typeof options.backgroundApi,
    handlers: [EQRCodeHandlerNames.lightningNetwork],
  };
  return { serverValidateAddress, serviceLightning, parseOptions };
}

describe('lightningNetwork QR handler', () => {
  it.each([
    ['a bare invoice', INVOICE],
    ['lightning:<invoice>', `lightning:${INVOICE}`],
    ['an upper case QR code', `lightning:${INVOICE}`.toUpperCase()],
  ])('reads %s as the bare invoice on mainnet', async (_label, value) => {
    const { options, findAndValidateLnurl, decodedInvoice } = setup();
    await expect(lightningNetwork(value, options)).resolves.toMatchObject({
      type: EQRCodeHandlerType.LIGHTNING_NETWORK,
      data: {
        address: INVOICE,
        network: { id: getNetworkIdsMap().lightning },
      },
    });
    expect(decodedInvoice).toHaveBeenCalledWith(INVOICE);
    expect(findAndValidateLnurl).not.toHaveBeenCalled();
  });

  it('sends a testnet invoice to the testnet network', async () => {
    const { options, getLnClient } = setup();
    await expect(
      lightningNetwork(`lightning:${TESTNET_INVOICE}`, options),
    ).resolves.toMatchObject({
      data: {
        address: TESTNET_INVOICE,
        network: { id: getNetworkIdsMap().tlightning },
      },
    });
    expect(getLnClient).toHaveBeenCalledWith(true);
  });

  it('reads an upper case LNURL in lower case and resolves its tag', async () => {
    const { options, findAndValidateLnurl } = setup();
    await expect(
      lightningNetwork(LNURL.toUpperCase(), options),
    ).resolves.toMatchObject({
      type: EQRCodeHandlerType.LIGHTNING_NETWORK,
      data: { address: LNURL, tag: 'payRequest' },
    });
    expect(findAndValidateLnurl).toHaveBeenCalledWith({
      toVal: LNURL,
      networkId: getNetworkIdsMap().lightning,
      forScan: true,
    });
  });

  it('takes a lightning address only behind the lightning: scheme', async () => {
    const { options } = setup();
    await expect(
      lightningNetwork('lightning:satoshi@example.com', options),
    ).resolves.toMatchObject({
      type: EQRCodeHandlerType.LIGHTNING_NETWORK,
      data: { address: 'satoshi@example.com' },
    });
    // Without the scheme it reads as an email address.
    await expect(
      lightningNetwork('satoshi@example.com', options),
    ).resolves.toBeNull();
  });

  it.each([
    ['a lightning: code that carries none of them', 'lightning:hello'],
    ['a bitcoin: code', 'bitcoin:bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'],
    ['a web link', 'https://onekey.so'],
  ])('leaves %s to the other handlers', async (_label, value) => {
    const { options } = setup();
    await expect(lightningNetwork(value, options)).resolves.toBeNull();
  });
});

it.each([
  ['a truncated invoice', INVOICE.slice(0, -4)],
  ['an invoice with a wrong checksum', `${INVOICE.slice(0, -1)}q`],
  ['a bare email with an LNURL prefix', 'LNURLalice@example.com'],
])('leaves %s to the copy fallback', async (_label, input) => {
  const { options, findAndValidateLnurl, getLnClient } = setup();
  await expect(lightningNetwork(input, options)).resolves.toBeNull();
  expect(getLnClient).not.toHaveBeenCalled();
  expect(findAndValidateLnurl).not.toHaveBeenCalled();
});

it.each(['lntbs', 'lnbcrt'])(
  'does not route %s to Lightning Testnet',
  async (prefix) => {
    const { options } = setup();
    const { words } = bech32.decode(INVOICE, INVOICE.length);
    const invoice = bech32.encode(prefix, words, INVOICE.length + 2);
    await expect(lightningNetwork(invoice, options)).resolves.toBeNull();
  },
);

it('requires a decoded invoice even when the checksum is valid', async () => {
  const { options, decodedInvoice, getNetwork } = setup();
  decodedInvoice.mockResolvedValueOnce({
    paymentRequest: '',
    tags: [],
    tagsObject: {},
  });
  await expect(lightningNetwork(INVOICE, options)).resolves.toBeNull();
  expect(getNetwork).not.toHaveBeenCalled();
});

it.each([
  ['absolute expiry', { timeExpireDate: 1_900_000_000 }],
  ['expiry tag', { timestamp: 1_899_999_940, tagsObject: { expire_time: 60 } }],
  ['default expiry', { timestamp: 1_899_996_400 }],
])(
  'uses the current time for a cached invoice with %s',
  async (_label, expiry) => {
    const { options, decodedInvoice, getNetwork } = setup();
    const request = {
      get: jest.fn(async () => ({
        data: {
          data: {
            paymentRequest: INVOICE,
            tags: [],
            tagsObject: {},
            ...expiry,
          },
        },
      })),
    };
    const client = new ClientLightning(
      options.backgroundApi,
      request as unknown as AxiosInstance,
      false,
    );
    decodedInvoice.mockImplementation((address) =>
      client.decodedInvoice(address),
    );
    const parseOptions = {
      ...options,
      handlers: [EQRCodeHandlerNames.lightningNetwork],
    };
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_899_999_999_000);
    try {
      await expect(parseQRCode(INVOICE, parseOptions)).resolves.toMatchObject({
        type: EQRCodeHandlerType.LIGHTNING_NETWORK,
      });
      now.mockReturnValue(1_900_000_000_000);
      const expired = parseQRCode(INVOICE, parseOptions);
      await expect(expired).rejects.toBeInstanceOf(InvoiceExpiredError);
      await expect(expired).rejects.toMatchObject({ autoToast: false });
      expect(request.get).toHaveBeenCalledTimes(1);
      expect(getNetwork).toHaveBeenCalledTimes(1);
    } finally {
      now.mockRestore();
    }
  },
);

it('resolves a recognized LNURL URI and preserves its scheme for validation', async () => {
  const { options, findAndValidateLnurl } = setup();
  const address = 'lnurlp://example.com/pay';
  await expect(lightningNetwork(address, options)).resolves.toMatchObject({
    data: { address, tag: 'payRequest' },
  });
  expect(findAndValidateLnurl).toHaveBeenCalledWith({
    toVal: address,
    networkId: getNetworkIdsMap().lightning,
    forScan: true,
  });
});

it.each([
  ['HTTP 503', new OneKeyServerApiError({ httpStatusCode: 503 })],
  [
    'HTTP 429',
    Object.assign(new Error('rate limited'), { httpStatusCode: 429 }),
  ],
  ['a timeout', new AxiosError('timeout', AxiosError.ECONNABORTED)],
  [
    'an offline connection',
    new OneKeyError({ className: EOneKeyErrorClassNames.AxiosNetworkError }),
  ],
])('keeps an LNURL scan retryable after %s', async (_label, error) => {
  const { parseOptions, serverValidateAddress } = setupRecipientValidation();
  serverValidateAddress.mockRejectedValueOnce(error);
  const value = 'lightning:satoshi@example.com';
  const time = 1_900_000_000_000;
  const now = jest.spyOn(Date, 'now').mockReturnValue(time);
  try {
    await expect(parseQRCode(value, parseOptions)).rejects.toMatchObject({
      autoToast: false,
    });
    now.mockReturnValue(time + 999);
    await expect(parseQRCode(value, parseOptions)).rejects.toMatchObject({
      autoToast: false,
    });
    expect(serverValidateAddress).toHaveBeenCalledTimes(1);
    now.mockReturnValue(time + 1000);
    await expect(parseQRCode(value, parseOptions)).resolves.toMatchObject({
      type: EQRCodeHandlerType.LIGHTNING_NETWORK,
    });
    expect(serverValidateAddress).toHaveBeenCalledTimes(2);
  } finally {
    now.mockRestore();
  }
});

it.each([
  new OneKeyServerApiError({ httpStatusCode: 400 }),
  new OneKeyLocalError('Invalid lnurl'),
])('keeps the copy fallback for an invalid LNURL', async (error) => {
  const { parseOptions, serverValidateAddress } = setupRecipientValidation();
  serverValidateAddress.mockRejectedValueOnce(error);
  await expect(parseQRCode(LNURL, parseOptions)).resolves.toMatchObject({
    type: EQRCodeHandlerType.UNKNOWN,
  });
  await expect(parseQRCode(LNURL, parseOptions)).resolves.toMatchObject({
    type: EQRCodeHandlerType.LIGHTNING_NETWORK,
  });
  expect(serverValidateAddress).toHaveBeenCalledTimes(2);
});

it('retries an invoice after a transient decoder failure', async () => {
  const { options, decodedInvoice, getNetwork } = setup();
  decodedInvoice.mockRejectedValueOnce(new Error('decoder timeout'));
  const parseOptions = {
    ...options,
    handlers: [EQRCodeHandlerNames.lightningNetwork],
  };

  await expect(parseQRCode(INVOICE, parseOptions)).rejects.toThrow();
  expect(getNetwork).not.toHaveBeenCalled();
  await expect(parseQRCode(INVOICE, parseOptions)).resolves.toMatchObject({
    type: EQRCodeHandlerType.LIGHTNING_NETWORK,
  });
});

it('keeps an invoice retryable when the Lightning client fails to initialize', async () => {
  const { options, getLnClient, decodedInvoice, getNetwork } = setup();
  const parseOptions = {
    ...options,
    handlers: [EQRCodeHandlerNames.lightningNetwork],
  };
  getLnClient.mockRejectedValueOnce(
    new OneKeyServerApiError({ httpStatusCode: 503 }),
  );

  const first = parseQRCode(INVOICE, parseOptions);
  await expect(first).rejects.toBeInstanceOf(RetryableLightningScanError);
  await expect(first).rejects.toMatchObject({ autoToast: false });
  expect(decodedInvoice).not.toHaveBeenCalled();
  expect(getNetwork).not.toHaveBeenCalled();
  await expect(parseQRCode(INVOICE, parseOptions)).resolves.toMatchObject({
    type: EQRCodeHandlerType.LIGHTNING_NETWORK,
  });
});

it('backs off repeated scans of a rate-limited recipient until Retry-After elapses', async () => {
  const { parseOptions, serverValidateAddress } = setupRecipientValidation();
  const value = 'lightning:satoshi@example.com';
  const failure = new OneKeyServerApiError({ httpStatusCode: 429 });
  failure.retryAfter = '30';
  serverValidateAddress.mockRejectedValueOnce(failure);
  const time = 1_900_000_000_000;
  const now = jest.spyOn(Date, 'now').mockReturnValue(time);
  try {
    await expect(parseQRCode(value, parseOptions)).rejects.toMatchObject({
      autoToast: false,
    });
    now.mockReturnValue(time + 29_999);
    await expect(
      parseQRCode('LIGHTNING:satoshi@example.com', parseOptions),
    ).rejects.toMatchObject({ autoToast: false });
    expect(serverValidateAddress).toHaveBeenCalledTimes(1);
    await expect(
      parseQRCode('lightning:another@example.com', parseOptions),
    ).resolves.toMatchObject({ type: EQRCodeHandlerType.LIGHTNING_NETWORK });
    now.mockReturnValue(time + 30_000);
    await expect(parseQRCode(value, parseOptions)).resolves.toMatchObject({
      type: EQRCodeHandlerType.LIGHTNING_NETWORK,
    });
    expect(serverValidateAddress).toHaveBeenCalledTimes(3);
  } finally {
    now.mockRestore();
  }
});

it('shares an in-flight recipient lookup between normalized scans without mixing networks', async () => {
  const { serviceLightning, serverValidateAddress } =
    setupRecipientValidation();
  const networks = getNetworkIdsMap();
  const address = 'satoshi@example.com';
  const lookup = (networkId: string, toVal: string) =>
    serviceLightning.findAndValidateLnurl({
      toVal,
      networkId,
      forScan: true,
    });
  await Promise.all([
    lookup(networks.lightning, address),
    lookup(networks.lightning, `LIGHTNING:${address}`),
    lookup(networks.tlightning, address),
  ]);
  expect(serverValidateAddress.mock.calls).toEqual([
    [{ networkId: networks.lightning, address }],
    [{ networkId: networks.tlightning, address }],
  ]);
});

it('still falls back when the decoder rejects an invalid invoice', async () => {
  const { options, decodedInvoice, getNetwork } = setup();
  decodedInvoice.mockRejectedValueOnce(
    Object.assign(new Error('invalid invoice'), { httpStatusCode: 400 }),
  );

  await expect(
    parseQRCode(INVOICE, {
      ...options,
      handlers: [EQRCodeHandlerNames.lightningNetwork],
    }),
  ).resolves.toMatchObject({ type: EQRCodeHandlerType.UNKNOWN });
  expect(getNetwork).not.toHaveBeenCalled();
});
