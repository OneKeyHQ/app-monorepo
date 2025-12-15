import { createContext, useContext } from 'react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  IKeylessShareCardProps,
  IKeylessShareCardsCardContextValue,
} from './keylessOnboardingTypes';

export const KeylessShareCardsContext =
  createContext<IKeylessShareCardsCardContextValue | null>(null);

export function useKeylessShareCardsContext() {
  const ctx = useContext(KeylessShareCardsContext);
  if (!ctx) {
    throw new OneKeyLocalError('KeylessShareCardsContext not found');
  }
  return ctx;
}

export type { IKeylessShareCardProps };
