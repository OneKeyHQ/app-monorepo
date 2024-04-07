// node_modules/@wagmi/core/src/createEmitter.ts

/* eslint-disable @typescript-eslint/naming-convention */
import { EventEmitter } from 'eventemitter3';

type EventMap = Record<string, object | never>;
type EventKey<eventMap extends EventMap> = string & keyof eventMap;
type EventFn<parameters extends unknown[] = any[]> = (
  ...parameters: parameters
) => void;
export type EventData<
  eventMap extends EventMap,
  eventName extends keyof eventMap,
> = (eventMap[eventName] extends [never] ? unknown : eventMap[eventName]) & {
  uid: string;
};

export class Emitter<eventMap extends EventMap> {
  #emitter = new EventEmitter();

  // eslint-disable-next-line no-useless-constructor
  constructor(public uid: string) {
    // eslint-disable-next-line no-empty-function
  }

  on<key extends EventKey<eventMap>>(
    eventName: key,
    fn: EventFn<
      eventMap[key] extends [never]
        ? [{ uid: string }]
        : [data: eventMap[key] & { uid: string }]
    >,
  ) {
    this.#emitter.on(eventName, fn as EventFn);
  }

  once<key extends EventKey<eventMap>>(
    eventName: key,
    fn: EventFn<
      eventMap[key] extends [never]
        ? [{ uid: string }]
        : [data: eventMap[key] & { uid: string }]
    >,
  ) {
    this.#emitter.once(eventName, fn as EventFn);
  }

  off<key extends EventKey<eventMap>>(
    eventName: key,
    fn: EventFn<
      eventMap[key] extends [never]
        ? [{ uid: string }]
        : [data: eventMap[key] & { uid: string }]
    >,
  ) {
    this.#emitter.off(eventName, fn as EventFn);
  }

  emit<key extends EventKey<eventMap>>(
    eventName: key,
    ...params: eventMap[key] extends [never] ? [] : [data: eventMap[key]]
  ) {
    const data = params[0];
    this.#emitter.emit(eventName, { uid: this.uid, ...data });
  }

  listenerCount<key extends EventKey<eventMap>>(eventName: key) {
    return this.#emitter.listenerCount(eventName);
  }
}

export function createEmitter<eventMap extends EventMap>(uid: string) {
  return new Emitter<eventMap>(uid);
}
