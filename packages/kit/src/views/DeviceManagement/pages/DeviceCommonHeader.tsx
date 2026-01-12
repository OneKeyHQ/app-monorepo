import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { NavBackButton, Page, XStack, useMedia } from '@onekeyhq/components';
import { AccountSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useDeviceBackNavigation } from '../hooks/useDeviceBackNavigation';

interface IDeviceCommonHeaderProps {
  title: string;
}

export function DeviceCommonHeader({ title }: IDeviceCommonHeaderProps) {
  const { gtMd } = useMedia();
  const { handleBackPress } = useDeviceBackNavigation();

  const customHeaderLeft = useMemo(
    () => (
      <XStack gap="$3" ai="center">
        <NavBackButton onPress={handleBackPress} />
      </XStack>
    ),
    [handleBackPress],
  );

  if (gtMd) {
    return (
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.DeviceManagement}
        customHeaderLeftItems={customHeaderLeft}
      />
    );
  }

  return <Page.Header title={title} />;
}
