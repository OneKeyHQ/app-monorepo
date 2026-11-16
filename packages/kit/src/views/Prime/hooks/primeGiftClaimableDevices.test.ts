import { EDeviceType } from '@onekeyfe/hd-shared';

import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IPrimeGiftEligibilityCache } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';
import type { IPrimeGiftEligibility } from '@onekeyhq/shared/types/prime/primeGiftTypes';

import {
  pickPrimeGiftCandidates,
  selectClaimable,
} from './primeGiftClaimableDevices';

import type { IPrimeGiftDeviceCandidate } from './primeGiftClaimableDevices';

function buildDevice(
  overrides: Partial<IDBDevice> &
    Pick<IDBDevice, 'deviceType' | 'createdAt' | 'uuid'>,
): IDBDevice {
  return {
    id: overrides.uuid,
    features: '',
    connectId: overrides.uuid,
    name: 'OneKey Pro 2',
    deviceId: overrides.uuid,
    settingsRaw: '',
    updatedAt: overrides.createdAt,
    ...overrides,
  } as IDBDevice;
}

function buildWallet(id: string, name = id): IDBWallet {
  return { id, name } as IDBWallet;
}

function entry(
  walletId: string,
  device: IDBDevice | undefined,
): IHwQrWalletWithDevice {
  return { wallet: buildWallet(walletId, `${walletId}-name`), device };
}

function eligibility(
  overrides: Partial<IPrimeGiftEligibility> = {},
): IPrimeGiftEligibility {
  return {
    sno: 'SN',
    eligible: true,
    hasUnclaimedGift: true,
    giftDays: 180,
    giftMonths: 6,
    ...overrides,
  };
}

function candidate(
  serialNo: string,
  createdAt: number,
): IPrimeGiftDeviceCandidate {
  return {
    serialNo,
    createdAt,
    device: buildDevice({
      deviceType: EDeviceType.Pro2,
      createdAt,
      uuid: serialNo,
    }),
    wallet: buildWallet(serialNo),
  };
}

describe('pickPrimeGiftCandidates', () => {
  it('keeps Pro 2 devices that have a serial and drops the rest', () => {
    const withIdentitySerial = buildDevice({
      deviceType: EDeviceType.Pro2,
      createdAt: 2,
      uuid: '',
      deviceStateInfo: {
        identity: { serialNo: '  PRO2-SERIAL  ' },
      },
    } as Partial<IDBDevice> &
      Pick<IDBDevice, 'deviceType' | 'createdAt' | 'uuid'>);
    const result = pickPrimeGiftCandidates({
      classic: entry(
        'classic',
        buildDevice({
          deviceType: EDeviceType.Classic,
          createdAt: 1,
          uuid: 'CLASSIC',
        }),
      ),
      missing: entry(
        'missing',
        buildDevice({
          deviceType: EDeviceType.Pro2,
          createdAt: 3,
          uuid: '   ',
        }),
      ),
      absent: entry('absent', undefined),
      uuidOnly: entry(
        'uuid-wallet',
        buildDevice({
          deviceType: EDeviceType.Pro2,
          createdAt: 4,
          uuid: 'UUID-SERIAL',
        }),
      ),
      identity: entry('identity-wallet', withIdentitySerial),
    });

    expect(result.map((item) => item.serialNo)).toEqual([
      'PRO2-SERIAL',
      'UUID-SERIAL',
    ]);
    expect(result.map((item) => item.wallet.id)).toEqual([
      'identity-wallet',
      'uuid-wallet',
    ]);
  });

  it('dedupes one serial and orders devices by createdAt', () => {
    const older = buildDevice({
      deviceType: EDeviceType.Pro2,
      createdAt: 10,
      uuid: 'dup-uuid',
      deviceStateInfo: { identity: { serialNo: 'SHARED' } },
    } as Partial<IDBDevice> &
      Pick<IDBDevice, 'deviceType' | 'createdAt' | 'uuid'>);
    const newer = buildDevice({
      deviceType: EDeviceType.Pro2,
      createdAt: 20,
      uuid: 'other-uuid',
      deviceStateInfo: { identity: { serialNo: 'SHARED' } },
    } as Partial<IDBDevice> &
      Pick<IDBDevice, 'deviceType' | 'createdAt' | 'uuid'>);
    const result = pickPrimeGiftCandidates({
      later: entry('later-wallet', newer),
      earlier: entry('earlier-wallet', older),
      other: entry(
        'other-wallet',
        buildDevice({
          deviceType: EDeviceType.Pro2,
          createdAt: 5,
          uuid: 'OTHER',
        }),
      ),
    });

    expect(result.map((item) => [item.serialNo, item.wallet.id])).toEqual([
      ['OTHER', 'other-wallet'],
      ['SHARED', 'earlier-wallet'],
    ]);
  });

  it('returns an empty list when device management has nothing to claim', () => {
    expect(pickPrimeGiftCandidates({})).toEqual([]);
  });
});

describe('selectClaimable', () => {
  const candidates = [
    candidate('later', 20),
    candidate('ready', 10),
    candidate('missing', 1),
  ];

  it('keeps only eligible devices that still have an unclaimed gift', () => {
    const cache: IPrimeGiftEligibilityCache = {
      later: eligibility(),
      ready: eligibility(),
      missing: eligibility({ eligible: false }),
    };

    expect(
      selectClaimable(candidates, cache).map((item) => item.serialNo),
    ).toEqual(['ready', 'later']);
    expect(
      selectClaimable(candidates, {}).map((item) => item.serialNo),
    ).toEqual([]);
    expect(selectClaimable([], cache)).toEqual([]);
  });

  it('drops a device whose gift flag is set but the device is not eligible', () => {
    const cache: IPrimeGiftEligibilityCache = {
      ready: eligibility({ eligible: false, hasUnclaimedGift: true }),
    };
    expect(selectClaimable([candidate('ready', 1)], cache)).toEqual([]);
  });
});
