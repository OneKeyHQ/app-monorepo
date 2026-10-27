import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';
import type {
  IDisplayComponentAddress,
  IDisplayComponentApprove,
  IDisplayComponentDefault,
} from '@onekeyhq/shared/types/signatureConfirm';

import { checksumDisplayComponentAddresses } from './displayComponentAddressUtils';

// EIP-55 reference vectors.
const lowerA = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed';
const checksumA = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
const lowerB = '0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359';
const checksumB = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359';
const solAddress = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';

function buildAddress(
  address: string,
  extra: Partial<IDisplayComponentAddress> = {},
): IDisplayComponentAddress {
  return {
    type: EParseTxComponentType.Address,
    label: 'To',
    address,
    tags: [],
    ...extra,
  };
}

describe('checksumDisplayComponentAddresses', () => {
  test('formats EVM Address component addresses to EIP-55 checksum', async () => {
    const result = await checksumDisplayComponentAddresses({
      networkId: 'evm--1',
      components: [buildAddress(lowerA)],
    });

    expect(result).toEqual([buildAddress(checksumA)]);
  });

  test('formats EVM Approve component spender to EIP-55 checksum', async () => {
    const approve = {
      type: EParseTxComponentType.Approve,
      label: 'Approve',
      spender: lowerB,
    } as IDisplayComponentApprove;

    const result = await checksumDisplayComponentAddresses({
      networkId: 'evm--1',
      components: [approve],
    });

    expect(result).toEqual([{ ...approve, spender: checksumB }]);
  });

  test('keeps non-EVM network addresses unchanged', async () => {
    const components = [buildAddress(solAddress)];

    const result = await checksumDisplayComponentAddresses({
      networkId: 'sol--101',
      components,
    });

    expect(result).toEqual(components);
  });

  test('prefers the component networkId over the transaction networkId', async () => {
    const result = await checksumDisplayComponentAddresses({
      networkId: 'evm--1',
      components: [
        buildAddress(solAddress, { networkId: 'sol--101' }),
        buildAddress(lowerA, { networkId: 'evm--42161' }),
      ],
    });

    expect(result).toEqual([
      buildAddress(solAddress, { networkId: 'sol--101' }),
      buildAddress(checksumA, { networkId: 'evm--42161' }),
    ]);
  });

  test('keeps values that are not valid EVM addresses unchanged', async () => {
    const components = [
      buildAddress('vitalik.eth'),
      buildAddress('0xserver-contract'),
      buildAddress(''),
    ];

    const result = await checksumDisplayComponentAddresses({
      networkId: 'evm--1',
      components,
    });

    expect(result).toEqual(components);
  });

  test('returns the same array instance when nothing changes', async () => {
    const components = [buildAddress(checksumA), buildAddress(solAddress)];

    const result = await checksumDisplayComponentAddresses({
      networkId: 'evm--1',
      components,
    });

    expect(result).toBe(components);
  });

  test('passes other component types through by reference', async () => {
    const defaultComponent: IDisplayComponentDefault = {
      type: EParseTxComponentType.Default,
      label: 'Owner',
      value: lowerA,
    };

    const result = await checksumDisplayComponentAddresses({
      networkId: 'evm--1',
      components: [defaultComponent],
    });

    expect(result[0]).toBe(defaultComponent);
  });
});
