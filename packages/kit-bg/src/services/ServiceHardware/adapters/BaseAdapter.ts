import {
  type IThirdPartyHardwareUiState,
  publishThirdPartyHardwareUiState,
  thirdPartyHardwareUiStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import type {
  IAdapterUiEvent,
  IAdapterUiResponse,
  IHardwareWallet,
  IThirdPartyHardwareConnectionStateEvent,
} from './types';

export abstract class BaseAdapter {
  abstract readonly vendor: EHardwareVendor;

  abstract readonly hw: IHardwareWallet;

  private uiStateOwner?: { uiRequestId: string; sessionId?: string };

  protected publishUiState(
    state: Omit<IThirdPartyHardwareUiState, 'uiRequestId'>,
    sessionId?: string,
  ): Promise<void> {
    const uiRequestId = generateUUID();
    this.uiStateOwner = {
      uiRequestId,
      sessionId,
    };
    return publishThirdPartyHardwareUiState(state, uiRequestId);
  }

  protected clearUiState(sessionId?: string): Promise<void> {
    const owner = this.uiStateOwner;
    // A delayed SDK completion must not dismiss another session's prompt.
    if (sessionId && owner?.sessionId !== sessionId) return Promise.resolve();
    return thirdPartyHardwareUiStateAtom.set((state) =>
      owner &&
      state?.vendor === this.vendor &&
      state.uiRequestId === owner.uiRequestId
        ? undefined
        : state,
    );
  }

  protected restoreProcessingUiState(
    action: IThirdPartyHardwareUiState['action'],
    sessionId?: string,
  ): Promise<void> {
    const owner = this.uiStateOwner;
    if (!owner) return Promise.resolve();
    if (sessionId && owner?.sessionId !== sessionId) return Promise.resolve();
    const replacement = { ...owner, uiRequestId: generateUUID() };
    this.uiStateOwner = replacement;
    // Completion may restore this operation's progress, but cannot replace a
    // newer prompt published by another adapter or the service layer.
    return thirdPartyHardwareUiStateAtom.set((state) =>
      this.uiStateOwner === replacement &&
      state?.vendor === this.vendor &&
      state.uiRequestId === owner.uiRequestId
        ? {
            ...state,
            action,
            payload: undefined,
            uiRequestId: replacement.uiRequestId,
          }
        : state,
    );
  }

  private uiEventHandlers = new Set<(event: IAdapterUiEvent) => void>();

  private connectionStateHandlers = new Set<
    (event: IThirdPartyHardwareConnectionStateEvent) => void
  >();

  onUiEvent(handler: (event: IAdapterUiEvent) => void): () => void {
    this.uiEventHandlers.add(handler);
    return () => {
      this.uiEventHandlers.delete(handler);
    };
  }

  onConnectionStateChange(
    handler: (event: IThirdPartyHardwareConnectionStateEvent) => void,
  ): () => void {
    this.connectionStateHandlers.add(handler);
    return () => {
      this.connectionStateHandlers.delete(handler);
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
    void this.clearUiState();
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

  protected emitConnectionStateChange(
    event: IThirdPartyHardwareConnectionStateEvent,
  ): void {
    for (const handler of this.connectionStateHandlers) {
      handler(event);
    }
  }
}
