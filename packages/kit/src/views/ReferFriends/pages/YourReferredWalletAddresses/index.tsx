import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { ListView, Page, SizableText } from '@onekeyhq/components';
import {
  AccountSelectorProviderMirror,
  ControlledNetworkSelectorIconTrigger,
} from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type {
  EModalReferFriendsRoutes,
  IModalReferFriendsParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferFriendsPageContainer } from '../../components';

import type { RouteProp } from '@react-navigation/core';

function YourReferredWalletAddressesPageWrapper() {
  // Redirect to ReferAFriend page if user is not logged in
  useRedirectWhenNotLoggedIn();

  const intl = useIntl();
  const { params } =
    useRoute<
      RouteProp<
        IModalReferFriendsParamList,
        EModalReferFriendsRoutes.YourReferredWalletAddresses
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
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.referral_referred_address,
        })}
        headerRight={renderHeaderRight}
      />
      <Page.Body>
        <ReferFriendsPageContainer>
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
        </ReferFriendsPageContainer>
      </Page.Body>
    </Page>
  );
}

export default function YourReferredWalletAddresses() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <YourReferredWalletAddressesPageWrapper />
    </AccountSelectorProviderMirror>
  );
}
