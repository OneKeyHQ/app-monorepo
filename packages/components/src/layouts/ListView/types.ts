import type { ComponentType, ReactElement } from 'react';

// React Native 0.87+ strict types dropped `null` from the list header/footer/
// empty slots, but VirtualizedList and FlashList still treat any falsy value
// as "render nothing", so keep accepting `null` from callers.
export type IListSlotComponent =
  | ComponentType<any>
  | ReactElement
  | null
  | undefined;
