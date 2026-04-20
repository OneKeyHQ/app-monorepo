import type {
  IAdapterUiEvent,
  IAdapterUiEventType,
  IAdapterUiNotification,
  IAdapterUiRequest,
  IAdapterUiRequestType,
  IAdapterUiResponse,
  IHardwareWallet,
  IThirdPartyVendor,
} from './types';

export abstract class BaseAdapter {
  abstract readonly vendor: IThirdPartyVendor;

  abstract readonly hw: IHardwareWallet;

  private uiEventHandlers = new Set<(event: IAdapterUiEvent) => void>();

  private pendingUiResponse: {
    resolve: (response: IAdapterUiResponse) => void;
  } | null = null;

  onUiEvent(handler: (event: IAdapterUiEvent) => void): () => void {
    this.uiEventHandlers.add(handler);
    return () => {
      this.uiEventHandlers.delete(handler);
    };
  }

  uiResponse(response: IAdapterUiResponse): void {
    if (this.pendingUiResponse) {
      this.pendingUiResponse.resolve(response);
      this.pendingUiResponse = null;
    }
  }

  protected emitUiEvent(event: IAdapterUiEvent): void {
    for (const handler of this.uiEventHandlers) {
      handler(event);
    }
  }

  protected async emitRequest(
    type: IAdapterUiRequestType,
    payload?: IAdapterUiRequest['payload'],
  ): Promise<IAdapterUiResponse> {
    return new Promise<IAdapterUiResponse>((resolve) => {
      this.pendingUiResponse = { resolve };
      this.emitUiEvent({ kind: 'request', type, payload });
    });
  }

  protected emitNotification(
    type: IAdapterUiEventType,
    payload?: IAdapterUiNotification['payload'],
  ): void {
    this.emitUiEvent({ kind: 'ui-event', type, payload });
  }
}
