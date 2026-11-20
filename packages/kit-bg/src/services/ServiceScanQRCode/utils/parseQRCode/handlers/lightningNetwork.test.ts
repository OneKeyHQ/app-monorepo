import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EQRCodeHandlerType } from '@onekeyhq/shared/types/qrCode';

import lightningNetwork from './lightningNetwork';

import type { IQRCodeHandlerOptions } from '../type';

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
  const options = {
    backgroundApi: {
      serviceNetwork: {
        getNetwork: jest.fn(async ({ networkId }: { networkId: string }) => ({
          id: networkId,
        })),
      },
      serviceLightning: { findAndValidateLnurl },
    },
  } as unknown as IQRCodeHandlerOptions;
  return { options, findAndValidateLnurl };
}

describe('lightningNetwork QR handler', () => {
  it.each([
    ['a bare invoice', INVOICE],
    ['lightning:<invoice>', `lightning:${INVOICE}`],
    ['an upper case QR code', `lightning:${INVOICE}`.toUpperCase()],
  ])('reads %s as the bare invoice on mainnet', async (_label, value) => {
    const { options, findAndValidateLnurl } = setup();
    await expect(lightningNetwork(value, options)).resolves.toMatchObject({
      type: EQRCodeHandlerType.LIGHTNING_NETWORK,
      data: {
        address: INVOICE,
        network: { id: getNetworkIdsMap().lightning },
      },
    });
    expect(findAndValidateLnurl).not.toHaveBeenCalled();
  });

  it('sends a testnet invoice to the testnet network', async () => {
    const { options } = setup();
    await expect(
      lightningNetwork(`lightning:${TESTNET_INVOICE}`, options),
    ).resolves.toMatchObject({
      data: {
        address: TESTNET_INVOICE,
        network: { id: getNetworkIdsMap().tlightning },
      },
    });
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
