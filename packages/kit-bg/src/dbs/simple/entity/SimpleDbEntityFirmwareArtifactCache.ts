import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IFirmwareCacheEntry = {
  artifactRef: string;
  sha256: string;
  size: number;
  version: string;
};

export type IFirmwareArtifactCacheState = {
  slots: Record<string, IFirmwareCacheEntry>;
  leaseRef?: string;
};

export class SimpleDbEntityFirmwareArtifactCache extends SimpleDbEntityBase<IFirmwareArtifactCacheState> {
  entityName = 'firmwareArtifactCache';

  override enableCache = false;

  async getState(): Promise<IFirmwareArtifactCacheState> {
    return (await this.getRawData()) ?? { slots: {} };
  }

  async saveState(state: IFirmwareArtifactCacheState): Promise<void> {
    await this.setRawData(state);
  }
}
