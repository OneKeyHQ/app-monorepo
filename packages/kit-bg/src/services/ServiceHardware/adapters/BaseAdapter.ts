import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type {
  IAdapterUiEvent,
  IAdapterUiResponse,
  IHardwareWallet,
} from './types';

export abstract class BaseAdapter {
  abstract readonly vendor: EHardwareVendor;

  abstract readonly hw: IHardwareWallet;

  private uiEventHandlers = new Set<(event: IAdapterUiEvent) => void>();

  onUiEvent(handler: (event: IAdapterUiEvent) => void): () => void {
    this.uiEventHandlers.add(handler);
    return () => {
      this.uiEventHandlers.delete(handler);
    };
  }

  uiResponse(response: IAdapterUiResponse): void {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][${this.vendor}] uiResponse type=${
        (response as { type?: string })?.type ?? 'unknown'
      }`,
    );
    this.hw.uiResponse(response);
  }

  cancel(connectId?: string): void {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][${this.vendor}] cancel connectId=${connectId || '(empty)'}`,
    );
    this.hw.cancel(connectId);
  }

  protected emitUiEvent(event: IAdapterUiEvent): void {
    defaultLogger.hardware.sdkLog.log(
      `[3rdPartyHW][${this.vendor}] emitUiEvent kind=${event.kind} type=${event.type}`,
    );
    for (const handler of this.uiEventHandlers) {
      handler(event);
    }
  }
}
