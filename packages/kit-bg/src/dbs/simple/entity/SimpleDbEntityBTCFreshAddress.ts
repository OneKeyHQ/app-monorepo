import type {
  IBtcFreshAddress,
  IBtcFreshAddressStructure,
} from '@onekeyhq/core/src/chains/btc/types';
import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IBTCFreshAddressDb {
  data: Record<string, IBtcFreshAddressStructure>; // key: networkId-xpubSegwit
}

export type IBtcFreshAddressWithRelPath = IBtcFreshAddress & {
  relPath: string;
};

export type IBtcFreshAddressMap = Record<string, IBtcFreshAddressWithRelPath>;

const BTC_FRESH_ADDRESS_RAW_CACHE_TTL_MS = 30_000;

export class SimpleDbEntityBTCFreshAddress extends SimpleDbEntityBase<IBTCFreshAddressDb> {
  entityName = 'btcFreshAddress';

  override enableCache = true;

  private rawCacheExpiresAt = 0;

  private ensureRawCacheValid() {
    if (!this.enableCache) return;
    if (this.rawCacheExpiresAt && Date.now() > this.rawCacheExpiresAt) {
      this.clearRawDataCache();
      this.rawCacheExpiresAt = 0;
    }
  }

  private touchRawCacheTtl() {
    if (!this.enableCache) return;
    this.rawCacheExpiresAt = Date.now() + BTC_FRESH_ADDRESS_RAW_CACHE_TTL_MS;
  }

  @backgroundMethod()
  async getBTCFreshAddresses({
    networkId,
    xpubSegwit,
  }: {
    networkId: string;
    xpubSegwit: string;
  }) {
    const key = accountUtils.getBTCFreshAddressKey({ networkId, xpubSegwit });
    this.ensureRawCacheValid();
    const data = await this.getRawData();
    this.touchRawCacheTtl();
    return data?.data[key];
  }

  async getBTCFreshAddressMap({
    networkId,
    xpubSegwit,
  }: {
    networkId: string;
    xpubSegwit: string;
  }): Promise<IBtcFreshAddressMap> {
    const btcFreshAddresses = await this.getBTCFreshAddresses({
      networkId,
      xpubSegwit,
    });
    if (!btcFreshAddresses) {
      return {};
    }

    const result: IBtcFreshAddressMap = {};

    const appendAddress = (item: IBtcFreshAddress) => {
      const pathSegments = item.path.split('/').filter(Boolean);
      const relPath = `${pathSegments[4]}/${pathSegments[5]}`;
      result[item.name] = {
        ...item,
        relPath,
      };
    };

    [
      btcFreshAddresses.change?.used,
      btcFreshAddresses.change?.unused,
      btcFreshAddresses.fresh?.used,
      btcFreshAddresses.fresh?.unused,
    ].forEach((group) => {
      group?.forEach(appendAddress);
    });

    return result;
  }

  async updateBTCFreshAddresses({
    networkId,
    xpubSegwit,
    value,
  }: {
    networkId: string;
    xpubSegwit: string;
    value: IBtcFreshAddressStructure;
  }) {
    this.ensureRawCacheValid();
    await this.setRawData((data) => {
      const oldData = data ?? { data: {} };
      const key = accountUtils.getBTCFreshAddressKey({ networkId, xpubSegwit });
      oldData.data[key] = value;
      return oldData;
    });
    this.touchRawCacheTtl();
  }

  async getKeyByAddress({
    networkId,
    address,
  }: {
    networkId: string;
    address: string;
  }): Promise<string | undefined> {
    if (!networkId) {
      return undefined;
    }
    const trimmedAddress = address?.trim();
    if (!trimmedAddress) {
      return undefined;
    }
    this.ensureRawCacheValid();
    const raw = await this.getRawData();
    this.touchRawCacheTtl();
    const entries = Object.entries(raw?.data ?? {});
    const networkKeyPrefix = `${networkId}__`;
    for (const [key, record] of entries) {
      if (!key.startsWith(networkKeyPrefix)) {
        // eslint-disable-next-line no-continue
        continue;
      }
      if (!record) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const groups = [
        record.change?.used,
        record.change?.unused,
        record.fresh?.used,
        record.fresh?.unused,
      ];
      const found = groups.some((items) =>
        items?.some(
          (item) =>
            item.address === trimmedAddress || item.name === trimmedAddress,
        ),
      );
      if (found) {
        return key;
      }
    }
    return undefined;
  }
}
