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
    this.hw.uiResponse(response);
  }

  protected emitUiEvent(event: IAdapterUiEvent): void {
    for (const handler of this.uiEventHandlers) {
      handler(event);
    }
  }
}
