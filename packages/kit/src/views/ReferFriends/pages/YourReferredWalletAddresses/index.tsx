import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { ListView, Page, SizableText } from '@onekeyhq/components';
import { ControlledNetworkSelectorIconTrigger } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ETabReferFriendsRoutes,
  ITabReferFriendsParamList,
} from '@onekeyhq/shared/src/routes';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import type { RouteProp } from '@react-navigation/core';

export default function YourReferredWalletAddresses() {
  // Redirect to ReferAFriend page if user is not logged in
  useRedirectWhenNotLoggedIn();

  const intl = useIntl();
  const { params } =
    useRoute<
      RouteProp<
        ITabReferFriendsParamList,
        ETabReferFriendsRoutes.TabYourReferredWalletAddresses
      >
    >();

  const { items, networks } = params;

  const networkIds = useMemo(
    () => (items ? items.map((i) => i.networkId) : []),
    [items],
  );
  const [networkId, setNetworkId] = useState(
    networkIds[0] || networks?.[0]?.networkId,
  );

  const renderHeaderRight = useCallback(() => {
    return (
      <ControlledNetworkSelectorIconTrigger
        value={networkId}
        onChange={setNetworkId}
        networkIds={networkIds}
      />
    );
  }, [networkId, networkIds]);

  if (!params) {
    return null;
  }
  if (!items || !networks) {
    return null;
  }

  return (
    <Page scrollEnabled>
      {platformEnv.isNative ? (
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.referral_referred_address,
          })}
          headerRight={renderHeaderRight}
        />
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.ReferFriends}
        />
      )}
      <Page.Body>
        <ListView
          contentContainerStyle={{ pb: '$20' }}
          estimatedItemSize={48}
          data={items.filter((i) => i.networkId === networkId)}
          renderItem={({ item }) => (
            <ListItem
              my="$1"
              title={accountUtils.shortenAddress({
                address: item.address,
                leadingLength: 6,
                trailingLength: 4,
              })}
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {item.createdAt ? formatDate(item.createdAt) : ''}
              </SizableText>
            </ListItem>
          )}
        />
      </Page.Body>
    </Page>
  );
}
