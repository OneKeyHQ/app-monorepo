import type { ReactNode } from 'react';

import { ModifierHintRevealProvider } from '@onekeyhq/components';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function DesktopModifierHintRevealProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [devSettings] = useDevSettingsPersistAtom();
  const enabled =
    platformEnv.isDesktop &&
    !(devSettings.enabled && devSettings.settings?.disableAllShortcuts);

  return (
    <ModifierHintRevealProvider enabled={enabled}>
      {children}
    </ModifierHintRevealProvider>
  );
}
