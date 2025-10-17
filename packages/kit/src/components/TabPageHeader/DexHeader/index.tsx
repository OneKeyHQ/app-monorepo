import {
  DexHeader,
  HeaderNavigation,
  OneKeyLogo,
  XStack,
} from '@onekeyhq/components';

import { HeaderNotificationIconButton, OneKeyIdButton } from '../components';
import { MoreActionButton } from '../MoreActionButton';

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
      <MoreActionButton key="more-action" />
      {showNotificationButton ? <HeaderNotificationIconButton /> : null}
      {showDownloadButton ? <DownloadButton downloadUrl={downloadUrl} /> : null}
      {showLanguageButton ? <LanguageButton /> : null}
      {showThemeButton ? <ThemeButton /> : null}
      <OneKeyIdButton testID="dex-header-onekey-id" />
    </DexHeader>
  );
}
