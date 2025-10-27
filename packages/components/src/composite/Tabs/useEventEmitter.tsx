import * as React from 'react';

import type { EventArg, EventConsumer } from '@react-navigation/native';
import type { EventEmitter } from 'react-native/Libraries/Types/CodegenTypes';

export type INavigationEventEmitter<T extends Record<string, any>> =
  EventEmitter<T> & {
    create: (target: string) => EventConsumer<T>;
  };

type IListeners = ((e: any) => void)[];

/**
 * Hook to manage the event system used by the navigator to notify screens of various events.
 */
export function useEventEmitter<T extends Record<string, any>>(
  listen?: (e: any) => void,
): INavigationEventEmitter<T> {
  const listenRef = React.useRef(listen);

  // eslint-disable-next-line use-effect-no-deps/use-effect-no-deps
  React.useEffect(() => {
    listenRef.current = listen;
  });

  const listeners = React.useRef<Record<string, Record<string, IListeners>>>(
    Object.create(null),
  );

  const create = React.useCallback((target: string) => {
    const removeListener = (type: string, callback: (data: any) => void) => {
      const callbacks = listeners.current[type]
        ? listeners.current[type][target]
        : undefined;

      if (!callbacks) {
        return;
      }

      const index = callbacks.indexOf(callback);

      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };

    const addListener = (type: string, callback: (data: any) => void) => {
      listeners.current[type] = listeners.current[type] || {};
      listeners.current[type][target] = listeners.current[type][target] || [];
      listeners.current[type][target].push(callback);

      let removed = false;
      return () => {
        // Prevent removing other listeners when unsubscribing same listener multiple times
        if (!removed) {
          removed = true;
          removeListener(type, callback);
        }
      };
    };

    return {
      addListener,
      removeListener,
    };
  }, []);

  const emit = React.useCallback(
    ({
      type,
      data,
      target,
      canPreventDefault,
    }: {
      type: string;
      data?: any;
      target?: string;
      canPreventDefault?: boolean;
    }) => {
      const items = listeners.current[type] || {};

      // Copy the current list of callbacks in case they are mutated during execution
      const callbacks =
        target !== undefined
          ? items[target]?.slice()
          : ([] as IListeners)
              .concat(...Object.keys(items).map((t) => items[t]))
              .filter((cb, i, self) => self.lastIndexOf(cb) === i);

      const event: EventArg<any, any, any> = {
        get type() {
          return type;
        },
      };

      if (target !== undefined) {
        Object.defineProperty(event, 'target', {
          enumerable: true,
          get() {
            return target;
          },
        });
      }

      if (data !== undefined) {
        Object.defineProperty(event, 'data', {
          enumerable: true,
          get() {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return data;
          },
        });
      }

      if (canPreventDefault) {
        let defaultPrevented = false;

        Object.defineProperties(event, {
          defaultPrevented: {
            enumerable: true,
            get() {
              return defaultPrevented;
            },
          },
          preventDefault: {
            enumerable: true,
            value() {
              defaultPrevented = true;
            },
          },
        });
      }

      listenRef.current?.(event);

      callbacks?.forEach((cb) => cb(event));

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return event as any;
    },
    [],
  );

  return React.useMemo(
    () => ({ create, emit }),
    [create, emit],
  ) as unknown as INavigationEventEmitter<T>;
}
