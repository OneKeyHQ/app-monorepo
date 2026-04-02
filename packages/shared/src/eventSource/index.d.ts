export type IEventSourceBuiltInEventType =
  | 'open'
  | 'message'
  | 'error'
  | 'done'
  | 'close';
export type IEventSourceType<E extends string = never> =
  | E
  | IEventSourceBuiltInEventType;

export interface IEventSourceMessageEvent {
  type: 'message';
  data: string | null;
  lastEventId: string | null;
  url: string;
}

export interface IEventSourceOpenEvent {
  type: 'open';
}

export interface IEventSourceDoneEvent {
  type: 'done';
}

export interface IEventSourceCloseEvent {
  type: 'close';
}

export interface IEventSourceTimeoutEvent {
  type: 'timeout';
}

export interface IEventSourceErrorEvent {
  type: 'error';
  message: string;
  xhrState: number;
  xhrStatus: number;
}

export interface IEventSourceCustomEvent<E extends string> {
  type: E;
  data: string | null;
  lastEventId: string | null;
  url: string;
}

export interface IEventSourceExceptionEvent {
  type: 'exception';
  message: string;
  error: Error;
}

export interface IEventSourceOptions {
  method?: string;
  timeout?: number;
  timeoutBeforeConnection?: number;
  withCredentials?: boolean;
  headers?: Record<string, any>;
  body?: any;
  debug?: boolean;
  pollingInterval?: number;
  lineEndingCharacter?: string;
}

type IEventSourceBuiltInEventMap = {
  'message': IEventSourceMessageEvent;
  'open': IEventSourceOpenEvent;
  'done': IEventSourceDoneEvent;
  'close': IEventSourceCloseEvent;
  'error':
    | IEventSourceErrorEvent
    | IEventSourceTimeoutEvent
    | IEventSourceExceptionEvent;
};

export type IEventSourceEvent<
  E extends T,
  T extends string = any,
> = E extends IEventSourceBuiltInEventType
  ? IEventSourceBuiltInEventMap[E]
  : IEventSourceCustomEvent<E>;
export type IEventSourceListener<
  E extends string = never,
  T extends IEventSourceType<E> = IEventSourceType<E>,
> = (event: IEventSourceEvent<T>) => void;

declare class EventSource<E extends string = never> {
  constructor(url: URL | string, options?: IEventSourceOptions);

  open(): void;

  close(): void;

  addEventListener<T extends IEventSourceType<E>>(
    type: T,
    listener: IEventSourceListener<E, T>,
  ): void;

  removeEventListener<T extends IEventSourceType<E>>(
    type: T,
    listener: IEventSourceListener<E, T>,
  ): void;

  removeAllEventListeners<T extends IEventSourceType<E>>(type?: T): void;

  dispatch<T extends IEventSourceType<E>>(
    type: T,
    data: IEventSourceEvent<T>,
  ): void;
}

export default EventSource;
