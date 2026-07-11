import { forwardRef } from 'react';

import type {
  IHomeContainerProps,
  IHomeContainerRef,
} from './HomeContainer.types';

export function isHomeContainerAvailable(): boolean {
  return false;
}

export const HomeContainer = forwardRef<IHomeContainerRef, IHomeContainerProps>(
  ({ fallback = null }, _ref) => fallback,
);

HomeContainer.displayName = 'HomeContainer';
