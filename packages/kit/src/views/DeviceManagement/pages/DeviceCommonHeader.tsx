import { useMemo } from 'react';
import type { ComponentProps } from 'react';

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
  // The navigation bar's right item. A page that ever shows one passes this
  // on every render, undefined to clear it: the bar keeps an item the header
  // stops mentioning.
  headerRight?: ComponentProps<typeof Page.Header>['headerRight'];
}

export function DeviceCommonHeader({
  title,
  ...headerItems
}: IDeviceCommonHeaderProps) {
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

  return <Page.Header title={gtMd ? '' : title} {...headerItems} />;
}
