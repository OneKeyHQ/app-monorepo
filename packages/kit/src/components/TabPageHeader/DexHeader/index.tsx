import { useMemo } from 'react';

import {
  DexHeader,
  HeaderNavigation,
  Icon,
  XStack,
} from '@onekeyhq/components';
import type { IHeaderNavigationItem } from '@onekeyhq/components';

import { HeaderNotificationIconButton } from '../components';

import { DownloadButton, LanguageButton, ThemeButton } from './components';

export interface IDexHeaderContainerProps {
  showNotificationButton?: boolean;
  showDownloadButton?: boolean;
  showLanguageButton?: boolean;
  showThemeButton?: boolean;
  downloadUrl?: string;
  activeNavigationKey?: string;
  onNavigationChange?: (key: string) => void;
}

const BUTTON_SIZE = 'large' as const;
const BUTTON_ICON_SIZE = '$5' as const;

function OneKeyLogo() {
  return (
    <XStack px="$4" py="$3">
      <Icon name="OnekeyTextIllus" width={101} height={28} color="$text" />
    </XStack>
  );
}

export function DexHeaderContainer({
  showNotificationButton = true,
  showDownloadButton = true,
  showLanguageButton = true,
  showThemeButton = true,
  downloadUrl,
  activeNavigationKey,
  onNavigationChange,
}: IDexHeaderContainerProps = {}) {
  const navigationItems: IHeaderNavigationItem[] = useMemo(
    () => [
      { key: 'market', label: '市场' },
      { key: 'contract', label: '合约' },
      { key: 'defi', label: 'DeFi' },
      { key: 'swap', label: '兑换' },
      { key: 'commission', label: '返佣' },
    ],
    [],
  );

  const leftContent = (
    <XStack ai="center" gap="$2">
      <OneKeyLogo />
      <HeaderNavigation
        items={navigationItems}
        activeKey={activeNavigationKey}
        onTabChange={onNavigationChange}
      />
    </XStack>
  );

  return (
    <DexHeader leftContent={leftContent}>
      {showNotificationButton ? (
        <HeaderNotificationIconButton
          size={BUTTON_SIZE}
          iconSize={BUTTON_ICON_SIZE}
        />
      ) : null}
      {showDownloadButton ? (
        <DownloadButton
          size={BUTTON_SIZE}
          iconSize={BUTTON_ICON_SIZE}
          downloadUrl={downloadUrl}
        />
      ) : null}
      {showLanguageButton ? (
        <LanguageButton size={BUTTON_SIZE} iconSize={BUTTON_ICON_SIZE} />
      ) : null}
      {showThemeButton ? (
        <ThemeButton size={BUTTON_SIZE} iconSize={BUTTON_ICON_SIZE} />
      ) : null}
    </DexHeader>
  );
}
