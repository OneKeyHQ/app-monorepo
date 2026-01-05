import { useMemo } from 'react';

import { NavBackButton, XStack, useMedia } from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { TabPageHeader } from '../../../components/TabPageHeader';
import { useBulkSendBackNavigation } from '../hooks/useBulkSendBackNavigation';

function BulkSendBar() {
  const { handleBackPress } = useBulkSendBackNavigation();
  const media = useMedia();

  const customHeaderLeft = useMemo(
    () => (
      <XStack gap="$3" ai="center">
        <NavBackButton onPress={handleBackPress} />
      </XStack>
    ),
    [handleBackPress],
  );

  return (
    <TabPageHeader
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Home}
      customHeaderLeftItems={customHeaderLeft}
      hideSearch={!media.gtMd}
    />
  );
}

export default BulkSendBar;
