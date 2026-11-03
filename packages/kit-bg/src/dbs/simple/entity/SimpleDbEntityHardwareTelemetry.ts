import type { IBleCommunicationTelemetry } from '@onekeyhq/shared/src/logger/scopes/hardware/scenes/connection';
import type { IFirmwareArtifactDownloadTelemetry } from '@onekeyhq/shared/src/logger/scopes/update/scenes/firmware';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type IHardwareTelemetryEvent = {
  id: string;
  timestamp: number;
} & (
  | { kind: 'download'; params: IFirmwareArtifactDownloadTelemetry }
  | { kind: 'ble'; params: IBleCommunicationTelemetry }
);

export class SimpleDbEntityHardwareTelemetry extends SimpleDbEntityBase<{
  pending: IHardwareTelemetryEvent[];
}> {
  entityName = 'hardwareTelemetry';

  override enableCache = false;

  async enqueue(event: IHardwareTelemetryEvent): Promise<void> {
    await this.setRawData((data) => ({
      pending: [...(data?.pending ?? []), event].slice(-1000),
    }));
  }

  async getPending(): Promise<IHardwareTelemetryEvent[]> {
    return (await this.getRawData())?.pending ?? [];
  }

  async acknowledge(id: string): Promise<void> {
    await this.setRawData((data) => ({
      pending: (data?.pending ?? []).filter((event) => event.id !== id),
    }));
  }
}
