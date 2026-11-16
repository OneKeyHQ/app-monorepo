import { EDeviceType } from '@onekeyfe/hd-shared';

import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IPrimeGiftEligibilityCache } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';
import type { IPrimeGiftEligibility } from '@onekeyhq/shared/types/prime/primeGiftTypes';

export type IPrimeGiftDeviceCandidate = {
  serialNo: string;
  device: IDBDevice;
  wallet: IDBWallet;
  createdAt: number;
};

export type IPrimeGiftClaimableDevice = IPrimeGiftDeviceCandidate & {
  eligibility: IPrimeGiftEligibility;
};

function comparePrimeGiftCandidates(
  left: Pick<IPrimeGiftDeviceCandidate, 'createdAt' | 'serialNo'>,
  right: Pick<IPrimeGiftDeviceCandidate, 'createdAt' | 'serialNo'>,
) {
  if (left.createdAt !== right.createdAt) {
    return left.createdAt - right.createdAt;
  }
  if (left.serialNo < right.serialNo) return -1;
  if (left.serialNo > right.serialNo) return 1;
  return 0;
}

function toPrimeGiftCandidate(
  entry: IHwQrWalletWithDevice,
): IPrimeGiftDeviceCandidate | undefined {
  const { device, wallet } = entry;
  if (!device || device.deviceType !== EDeviceType.Pro2) return undefined;
  const serialNo = deviceUtils.getDeviceSerialNoFromDbDevice(device)?.trim();
  if (!serialNo) return undefined;
  return {
    serialNo,
    device,
    wallet,
    createdAt: device.createdAt,
  };
}

function keepEarlierCandidate(
  current: IPrimeGiftDeviceCandidate | undefined,
  next: IPrimeGiftDeviceCandidate,
) {
  if (!current || next.createdAt < current.createdAt) return next;
  if (next.createdAt > current.createdAt) return current;
  return next.wallet.id < current.wallet.id ? next : current;
}

export function pickPrimeGiftCandidates(
  walletsWithDevice: Record<string, IHwQrWalletWithDevice>,
): IPrimeGiftDeviceCandidate[] {
  const bySerial = new Map<string, IPrimeGiftDeviceCandidate>();
  for (const entry of Object.values(walletsWithDevice)) {
    const candidate = toPrimeGiftCandidate(entry);
    if (candidate) {
      bySerial.set(
        candidate.serialNo,
        keepEarlierCandidate(bySerial.get(candidate.serialNo), candidate),
      );
    }
  }
  return [...bySerial.values()].toSorted(comparePrimeGiftCandidates);
}

export function selectClaimable(
  candidates: IPrimeGiftDeviceCandidate[],
  eligibilityCache: IPrimeGiftEligibilityCache,
): IPrimeGiftClaimableDevice[] {
  const claimable: IPrimeGiftClaimableDevice[] = [];
  for (const candidate of candidates) {
    const eligibility = eligibilityCache[candidate.serialNo];
    if (eligibility?.eligible && eligibility.hasUnclaimedGift) {
      claimable.push({ ...candidate, eligibility });
    }
  }
  return claimable.toSorted(comparePrimeGiftCandidates);
}
