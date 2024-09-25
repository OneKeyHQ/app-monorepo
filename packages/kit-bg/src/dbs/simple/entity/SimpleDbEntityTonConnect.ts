import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ITonConnectData {
  lastEventId?: string;
  connections?: {
    origin: string;
    connectorId: string;
    connectorAddress: string;
    clientId: string;
    clientCode: string;
  }[];
}

export class SimpleDbEntityTonConnect extends SimpleDbEntityBase<ITonConnectData> {
  entityName = 'tonConnect';

  override enableCache = false;

  async setConnection({
    origin,
    connectorId,
    connectorAddress,
    clientId,
    clientCode,
  }: {
    origin: string;
    connectorId: string;
    connectorAddress: string;
    clientId: string;
    clientCode: string;
  }) {
    return this.setRawData(({ rawData }) => {
      const connections = rawData?.connections ?? [];
      const index = connections.findIndex(
        (item) => item.connectorId === connectorId,
      );
      if (index !== -1) {
        const connection = connections[index];
        connections[index] = {
          ...connection,
          origin,
          connectorId,
          connectorAddress,
          clientId,
          clientCode,
        };
        return {
          ...rawData,
          connections,
        };
      }
      connections.push({
        origin,
        connectorId,
        connectorAddress,
        clientId,
        clientCode,
      });
      return {
        ...rawData,
        connections,
      };
    });
  }

  async removeConnection({ connectorId }: { connectorId: string }) {
    return this.setRawData(({ rawData }) => {
      const connections = rawData?.connections?.filter(
        (item) => item.connectorId !== connectorId,
      );
      return {
        ...rawData,
        connections,
      };
    });
  }

  async clearConnections() {
    return this.setRawData(({ rawData }) => ({
      ...rawData,
      connections: [],
    }));
  }

  async getConnectionInfo({ connectorId }: { connectorId: string }) {
    const rawData = await this.getRawData();
    return rawData?.connections?.find(
      (item) => item.connectorId === connectorId,
    );
  }

  async getAllConnections() {
    const rawData = await this.getRawData();
    return rawData?.connections || [];
  }

  async getAllClientIds() {
    const rawData = await this.getRawData();
    return rawData?.connections?.map((item) => item.clientId) || [];
  }

  async getConnectionsByOrigin({ origin }: { origin: string }) {
    const rawData = await this.getRawData();
    return rawData?.connections?.filter((item) => item.origin === origin) || [];
  }

  async removeOrigin({ origin }: { origin: string }) {
    return this.setRawData(({ rawData }) => {
      const connections = rawData?.connections?.filter(
        (item) => item.origin !== origin,
      );
      return {
        ...rawData,
        connections,
      };
    });
  }

  setLastEventId({ lastEventId }: { lastEventId: string }) {
    return this.setRawData(({ rawData }) => ({
      ...rawData,
      lastEventId,
    }));
  }

  async getLastEventId() {
    const rawData = await this.getRawData();
    return rawData?.lastEventId ?? '';
  }

  async setConnectorAddress({
    origin,
    connectorAddress,
  }: {
    origin: string;
    connectorAddress: string;
  }) {
    return this.setRawData(({ rawData }) => {
      const connections = rawData?.connections ?? [];
      connections.forEach((item) => {
        if (item.origin === origin) {
          item.connectorAddress = connectorAddress;
        }
      });
      return {
        ...rawData,
        connections,
      };
    });
  }
}
