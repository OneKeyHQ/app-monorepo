import {
  DexHeader,
  HeaderNavigation,
  OneKeyLogo,
  XStack,
} from '@onekeyhq/components';

import { HeaderNotificationIconButton } from '../components';

import { DownloadButton, LanguageButton, ThemeButton } from './components';
import { useDexHeaderNavigation } from './hooks';

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

export function DexHeaderContainer({
  showNotificationButton = true,
  showDownloadButton = true,
  showLanguageButton = true,
  showThemeButton = true,
  downloadUrl,
  activeNavigationKey,
  onNavigationChange,
}: IDexHeaderContainerProps = {}) {
  const {
    navigationItems,
    activeNavigationKey: derivedActiveKey,
    handleNavigationChange,
  } = useDexHeaderNavigation({
    onNavigationChange,
    activeNavigationKey,
  });

  const leftContent = (
    <XStack ai="center" gap="$2">
      <OneKeyLogo />
      <HeaderNavigation
        items={navigationItems}
        activeKey={derivedActiveKey}
        onTabChange={handleNavigationChange}
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
