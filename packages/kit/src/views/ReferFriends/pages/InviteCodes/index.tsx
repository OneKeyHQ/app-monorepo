import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';

import { Page } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import type {
  EModalReferFriendsRoutes,
  IModalReferFriendsParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { CreateCodeButton } from '../InviteReward/components/InvitationDetailsSection/components/CreateCodeButton';
import { InviteCodeList } from '../InviteReward/components/InvitationDetailsSection/components/InviteCodeList';
import { useInviteCodeList } from '../InviteReward/components/InvitationDetailsSection/hooks/useInviteCodeList';
import { INVITE_COPY } from '../InviteReward/inviteCopy';

import type { RouteProp } from '@react-navigation/core';

function InviteCodesPage() {
  useRedirectWhenNotLoggedIn();

  const { codeListData, isLoading, refetch } = useInviteCodeList();
  const route =
    useRoute<
      RouteProp<
        IModalReferFriendsParamList,
        EModalReferFriendsRoutes.InviteCodes
      >
    >();
  const { inviteUrl } = route.params;

  // The invite page revalidates its summary when it regains focus, so a
  // renamed primary code shows up there without refetching it here.
  const handleCodeUpdated = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const renderHeaderRight = useCallback(
    () => (
      <CreateCodeButton
        remainingCodes={codeListData?.remainingCodes}
        onCodeCreated={() => {
          void refetch();
        }}
        inviteUrlTemplate={inviteUrl}
      />
    ),
    [codeListData?.remainingCodes, inviteUrl, refetch],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={INVITE_COPY.manageCodes}
        headerRight={renderHeaderRight}
      />
      <Page.Body px="$pagePadding" pb="$5">
        <InviteCodeList
          codeListData={codeListData}
          isLoading={isLoading ?? false}
          onCodeUpdated={handleCodeUpdated}
        />
      </Page.Body>
    </Page>
  );
}

export default function InviteCodes() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <InviteCodesPage />
    </AccountSelectorProviderMirror>
  );
}
