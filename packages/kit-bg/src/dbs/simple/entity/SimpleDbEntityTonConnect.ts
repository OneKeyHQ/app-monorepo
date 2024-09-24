import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ITonConnectData {
  lastEventId?: string;
  keyPair?: {
    privateKey: string;
    publicKey: string;
  };
  origins?: {
    [key: string]: {
      clientIds: string[];
      accountAddress: string;
    };
  };
}

export class SimpleDbEntityTonConnect extends SimpleDbEntityBase<ITonConnectData> {
  entityName = 'tonConnect';

  override enableCache = false;

  setKeyPair({
    privateKey,
    publicKey,
  }: {
    privateKey: string;
    publicKey: string;
  }) {
    return this.setRawData(({ rawData }) => ({
      ...rawData,
      keyPair: {
        privateKey,
        publicKey,
      },
    }));
  }

  async getKeyPair() {
    const rawData = await this.getRawData();
    return rawData?.keyPair;
  }

  setLastEventId(lastEventId: string) {
    return this.setRawData(({ rawData }) => ({
      ...rawData,
      lastEventId,
    }));
  }

  async getLastEventId() {
    const rawData = await this.getRawData();
    return rawData?.lastEventId;
  }

  setOriginInfo({
    origin,
    clientId,
    accountAddress,
  }: {
    origin: string;
    clientId?: string;
    accountAddress?: string;
  }) {
    return this.setRawData(({ rawData }) => {
      const origins = rawData?.origins ?? {};
      if (!origins[origin]) {
        origins[origin] = { clientIds: [], accountAddress: '' };
      }
      if (clientId && !origins[origin].clientIds.includes(clientId)) {
        origins[origin].clientIds.push(clientId);
      }
      if (accountAddress) {
        origins[origin].accountAddress = accountAddress;
      }
      return {
        ...rawData,
        origins,
      };
    });
  }

  async getOriginClientIds(origin: string) {
    const rawData = await this.getRawData();
    return rawData?.origins?.[origin]?.clientIds ?? [];
  }

  async getOriginAccountAddress(origin: string) {
    const rawData = await this.getRawData();
    return rawData?.origins?.[origin]?.accountAddress ?? '';
  }

  async getOrigins() {
    const rawData = await this.getRawData();
    return Object.keys(rawData?.origins ?? {});
  }

  removeOrigin(origin: string) {
    return this.setRawData(({ rawData }) => {
      const origins = rawData?.origins ?? {};
      delete origins[origin];
      return {
        ...rawData,
        origins,
      };
    });
  }
}
