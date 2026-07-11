import type { ReactNode } from 'react';

import type { INativeHomePageProps } from './NativeHomePage.types';

export type { INativeHomePageProps } from './NativeHomePage.types';

export function NativeHomePage({
  fallback = null,
}: INativeHomePageProps & { fallback?: ReactNode }) {
  return fallback;
}
