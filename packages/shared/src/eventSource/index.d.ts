export type BuiltInEventType = 'open' | 'message' | 'error' | 'done' | 'close';
export type EventType<E extends string = never> = E | BuiltInEventType;

export interface MessageEvent {
  type: 'message';
  data: string | null;
  lastEventId: string | null;
  url: string;
}

export interface OpenEvent {
  type: 'open';
}

export interface DoneEvent {
  type: 'done';
}

export interface CloseEvent {
  type: 'close';
}

export interface TimeoutEvent {
  type: 'timeout';
}

export interface ErrorEvent {
  type: 'error';
  message: string;
  xhrState: number;
  xhrStatus: number;
}

export interface CustomEvent<E extends string> {
  type: E;
  data: string | null;
  lastEventId: string | null;
  url: string;
}

export interface ExceptionEvent {
  type: 'exception';
  message: string;
  error: Error;
}

export interface EventSourceOptions {
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

type BuiltInEventMap = {
  'message': MessageEvent;
  'open': OpenEvent;
  'done': DoneEvent;
  'close': CloseEvent;
  'error': ErrorEvent | TimeoutEvent | ExceptionEvent;
};

export type EventSourceEvent<
  E extends T,
  T extends string = any,
> = E extends BuiltInEventType ? BuiltInEventMap[E] : CustomEvent<E>;
export type EventSourceListener<
  E extends string = never,
  T extends EventType<E> = EventType<E>,
> = (event: EventSourceEvent<T>) => void;

declare class EventSource<E extends string = never> {
  constructor(url: URL | string, options?: EventSourceOptions);
  open(): void;
  close(): void;
  addEventListener<T extends EventType<E>>(
    type: T,
    listener: EventSourceListener<E, T>,
  ): void;
  removeEventListener<T extends EventType<E>>(
    type: T,
    listener: EventSourceListener<E, T>,
  ): void;
  removeAllEventListeners<T extends EventType<E>>(type?: T): void;
  dispatch<T extends EventType<E>>(type: T, data: EventSourceEvent<T>): void;
}

export default EventSource;
