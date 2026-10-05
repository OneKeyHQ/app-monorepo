import { useMemo } from 'react';

import {
  NavBackButton,
  Page,
  XStack,
  useIsModalPage,
  useMedia,
} from '@onekeyhq/components';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useDeviceBackNavigation } from '../hooks/useDeviceBackNavigation';

interface IDeviceCommonHeaderProps {
  title: string;
}

export function DeviceCommonHeader({ title }: IDeviceCommonHeaderProps) {
  const { gtMd } = useMedia();
  const isModalPage = useIsModalPage();
  const { handleBackPress } = useDeviceBackNavigation();

  const customHeaderLeft = useMemo(
    () => (
      <XStack gap="$3" ai="center">
        <NavBackButton onPress={handleBackPress} />
      </XStack>
    ),
    [handleBackPress],
  );

  if (gtMd && !isModalPage) {
    return (
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.DeviceManagement}
        customHeaderLeftItems={customHeaderLeft}
      />
    );
  }

  return <Page.Header title={gtMd ? '' : title} />;
}
