import { forwardRef } from 'react';

import type {
  IHomeContainerProps,
  IHomeContainerRef,
} from './HomeContainer.types';

export function isHomeContainerAvailable(): boolean {
  return false;
}

export const HomeContainer = forwardRef<IHomeContainerRef, IHomeContainerProps>(
  (_props, _ref) => null,
);

HomeContainer.displayName = 'HomeContainer';
