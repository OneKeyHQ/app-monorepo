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
    };
  };
}

export class SimpleDbEntityTonConnect extends SimpleDbEntityBase<ITonConnectData> {
  entityName = 'tonConnectItems';

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

  setOriginClientId({
    origin,
    clientId,
  }: {
    origin: string;
    clientId: string;
  }) {
    return this.setRawData(({ rawData }) => {
      const origins = rawData?.origins ?? {};
      if (!origins[origin]) {
        origins[origin] = { clientIds: [] };
      }
      if (!origins[origin].clientIds.includes(clientId)) {
        origins[origin].clientIds.push(clientId);
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
