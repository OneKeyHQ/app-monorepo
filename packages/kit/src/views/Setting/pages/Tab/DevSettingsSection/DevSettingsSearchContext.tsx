import { createContext, useContext } from 'react';
import type { PropsWithChildren } from 'react';

const DevSettingsSearchContext = createContext('');

export const DevSettingsSearchProvider = DevSettingsSearchContext.Provider;

export function useMatchesDevSearch(
  ...searchableTexts: (string | undefined | null)[]
): boolean {
  const query = useContext(DevSettingsSearchContext);
  if (!query) return true;
  const combined = searchableTexts.filter(Boolean).join(' ').toLowerCase();
  return combined.includes(query);
}

export function SearchFilterItem({
  keywords,
  children,
}: PropsWithChildren<{ keywords: string }>) {
  const matches = useMatchesDevSearch(keywords);
  if (!matches) return null;
  return children;
}
