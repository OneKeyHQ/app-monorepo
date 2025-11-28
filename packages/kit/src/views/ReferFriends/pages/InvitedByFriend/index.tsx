import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, YStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalReferFriendsRoutes,
  IModalReferFriendsParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferFriendsPageContainer } from '../../components';

import {
  InvitedByFriendActions,
  InvitedByFriendContent,
  InvitedByFriendImage,
} from './components';

import type { RouteProp } from '@react-navigation/native';

function InvitedByFriendPage() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalReferFriendsParamList,
        EModalReferFriendsRoutes.InvitedByFriend
      >
    >();

  const referralCode = route.params?.code ?? '';
  const page = route.params?.page;

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.sidebar_refer_a_friend,
        })}
      />
      <Page.Body>
        <ReferFriendsPageContainer flex={1}>
          <YStack
            $gtMd={{ py: '$5' }}
            pb="$5"
            maxWidth={640}
            mx="auto"
            flex={1}
          >
            <InvitedByFriendImage />
            <InvitedByFriendContent />
          </YStack>
        </ReferFriendsPageContainer>
      </Page.Body>

      <Page.Footer>
        <InvitedByFriendActions referralCode={referralCode} page={page} />
      </Page.Footer>
    </Page>
  );
}

export default function InvitedByFriend() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <InvitedByFriendPage />
    </AccountSelectorProviderMirror>
  );
}
