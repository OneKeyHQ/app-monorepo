import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type * as HL from '@nktkas/hyperliquid';
import type { IHLActiveAssetData } from '@onekeyhq/shared/types/hyperliquid/sdk';

import type { SubscriptionType, SubscriptionConfig } from './SubscriptionConfig';

export interface IDataProcessor<TData = any> {
  process(key: string, data: TData, config: SubscriptionConfig): void;
  validate?(data: TData): boolean;
}

export abstract class BaseDataProcessor<TData = any> implements IDataProcessor<TData> {
  protected readonly processorName: string;

  constructor() {
    this.processorName = this.constructor.name;
  }

  abstract process(key: string, data: TData, config: SubscriptionConfig): void;

  protected emitToEventBus(
    eventType: 'market' | 'account',
    subType: string,
    data: any,
    additionalMetadata: any = {}
  ): void {
    appEventBus.emit(EAppEventBusNames.HyperliquidDataUpdate, {
      type: eventType,
      subType: subType as any,
      data,
      metadata: {
        timestamp: Date.now(),
        source: this.processorName,
        ...additionalMetadata,
      },
    });
  }

  protected parseKey(key: string): { type: string; params: string[] } {
    const parts = key.split(':');
    return {
      type: parts[0],
      params: parts.slice(1),
    };
  }

  protected processWithBasicMetadata(key: string, data: TData, config: SubscriptionConfig, additionalMetadata: any = {}): void {
    this.emitToEventBus(config.eventType, config.eventSubType, data, { key, ...additionalMetadata });
  }

  protected processWithCoin(key: string, data: TData, config: SubscriptionConfig): void {
    const { params } = this.parseKey(key);
    const coin = params[1];
    this.processWithBasicMetadata(key, data, config, { coin });
  }

  protected processWithUser(key: string, data: TData, config: SubscriptionConfig, additionalMetadata: any = {}): void {
    const { params } = this.parseKey(key);
    const userAddress = params[1];
    this.processWithBasicMetadata(key, data, config, { userId: userAddress, ...additionalMetadata });
  }

  validate(data: TData): boolean {
    return data != null;
  }
}

export class AllMidsProcessor extends BaseDataProcessor<HL.WsAllMids> {
  process(key: string, data: HL.WsAllMids, config: SubscriptionConfig): void {
    this.processWithBasicMetadata(key, data, config);
  }
}

export class ActiveAssetCtxProcessor extends BaseDataProcessor<HL.WsActiveAssetCtx | HL.WsActiveSpotAssetCtx> {
  process(key: string, data: HL.WsActiveAssetCtx | HL.WsActiveSpotAssetCtx, config: SubscriptionConfig): void {
    this.processWithCoin(key, data, config);
  }
}

export class WebData2Processor extends BaseDataProcessor<HL.WsWebData2> {
  process(key: string, data: HL.WsWebData2, config: SubscriptionConfig): void {
    this.processWithUser(key, data, config);
  }
}

export class L2BookProcessor extends BaseDataProcessor<HL.Book> {
  process(key: string, data: HL.Book, config: SubscriptionConfig): void {
    this.processWithCoin(key, data, config);
  }
}

export class CandleProcessor extends BaseDataProcessor<HL.Candle> {
  process(key: string, data: HL.Candle, config: SubscriptionConfig): void {
    const { params } = this.parseKey(key);
    const [, coin, interval] = params;
    this.processWithBasicMetadata(key, data, config, { coin, interval });
  }
}

export class TradesProcessor extends BaseDataProcessor<HL.WsTrade[]> {
  process(key: string, data: HL.WsTrade[], config: SubscriptionConfig): void {
    this.processWithCoin(key, data, config);
  }
}

export class BBOProcessor extends BaseDataProcessor<HL.WsBbo> {
  process(key: string, data: HL.WsBbo, config: SubscriptionConfig): void {
    this.processWithCoin(key, data, config);
  }
}

export class ActiveAssetDataProcessor extends BaseDataProcessor<IHLActiveAssetData> {
  process(key: string, data: IHLActiveAssetData, config: SubscriptionConfig): void {
    const { params } = this.parseKey(key);
    const [, userAddress, coin] = params;
    this.processWithBasicMetadata(key, data, config, { userId: userAddress, coin });
  }
}

export class UserEventsProcessor extends BaseDataProcessor<HL.WsUserEvent> {
  process(key: string, data: HL.WsUserEvent, config: SubscriptionConfig): void {
    this.processWithUser(key, data, config);
  }
}

export class UserNotificationsProcessor extends BaseDataProcessor<HL.WsNotification> {
  process(key: string, data: HL.WsNotification, config: SubscriptionConfig): void {
    this.processWithUser(key, data, config, { notificationType: 'notification' });
  }
}

const PROCESSOR_CLASSES = [
  AllMidsProcessor,
  ActiveAssetCtxProcessor,
  WebData2Processor,
  L2BookProcessor,
  CandleProcessor,
  TradesProcessor,
  BBOProcessor,
  ActiveAssetDataProcessor,
  UserEventsProcessor,
  UserNotificationsProcessor,
];

export class DataProcessorRegistry {
  private static instance: DataProcessorRegistry;
  private processors = new Map<string, IDataProcessor>();

  private constructor() {
    this.autoRegisterProcessors();
  }

  static getInstance(): DataProcessorRegistry {
    if (!DataProcessorRegistry.instance) {
      DataProcessorRegistry.instance = new DataProcessorRegistry();
    }
    return DataProcessorRegistry.instance;
  }

  private autoRegisterProcessors(): void {
    PROCESSOR_CLASSES.forEach(ProcessorClass => {
      const processor = new ProcessorClass();
      this.processors.set(ProcessorClass.name, processor);
    });
  }

  getProcessor(processorName: string): IDataProcessor {
    const processor = this.processors.get(processorName);
    if (!processor) {
      throw new Error(`Processor "${processorName}" not found`);
    }
    return processor;
  }

  registerProcessor(processor: IDataProcessor): void {
    this.processors.set(processor.constructor.name, processor);
  }

  getRegisteredProcessors(): string[] {
    return Array.from(this.processors.keys());
  }
}

export const dataProcessorRegistry = DataProcessorRegistry.getInstance();
