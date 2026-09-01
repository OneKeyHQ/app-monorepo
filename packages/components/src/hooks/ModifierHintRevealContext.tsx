import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

import { useModifierHintReveal } from './useModifierHintReveal';

type IModifierHintRevealContextValue = {
  visible: boolean;
};

const ModifierHintRevealContext =
  createContext<IModifierHintRevealContextValue>({
    visible: false,
  });

export function ModifierHintRevealProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const visible = useModifierHintReveal(enabled);
  const value = useMemo(() => ({ visible }), [visible]);

  return (
    <ModifierHintRevealContext.Provider value={value}>
      {children}
    </ModifierHintRevealContext.Provider>
  );
}

export function useModifierHintRevealVisible(): boolean {
  return useContext(ModifierHintRevealContext).visible;
}
