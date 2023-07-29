import { createContext } from 'react';

import type { ButtonProgressContextValues } from '../typings';

export const SwapButtonProgressContext =
  createContext<ButtonProgressContextValues>({});
export const LimitOrderButtonProgressContext =
  createContext<ButtonProgressContextValues>({});
