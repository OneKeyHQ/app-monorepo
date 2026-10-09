import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, SegmentControl } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalReferFriendsRoutes,
  IModalReferFriendsParamList,
  IReferralsPageTab,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { CreateCodeButton } from '../InviteReward/components/InvitationDetailsSection/components/CreateCodeButton';
import { InviteCodeList } from '../InviteReward/components/InvitationDetailsSection/components/InviteCodeList';
import { useInviteCodeList } from '../InviteReward/components/InvitationDetailsSection/hooks/useInviteCodeList';
import { INVITE_COPY } from '../InviteReward/inviteCopy';
import {
  ReferredHardwareOrders,
  ReferredWalletList,
} from '../YourReferred/components/ReferredLists';

import type { RouteProp } from '@react-navigation/core';

const REFERRALS_TABS: IReferralsPageTab[] = ['codes', 'wallets', 'orders'];

// Referrals: the user's codes, then the wallets and hardware orders those
// codes brought in. One page with flat tabs, so the invite home needs a
// single entry and the two views of the same people sit side by side.
function InviteCodesPage() {
  useRedirectWhenNotLoggedIn();

  const intl = useIntl();
  const { codeListData, isLoading, refetch } = useInviteCodeList();
  const route =
    useRoute<
      RouteProp<
        IModalReferFriendsParamList,
        EModalReferFriendsRoutes.InviteCodes
      >
    >();
  const { inviteUrl } = route.params;
  const [tab, setTab] = useState<IReferralsPageTab>(
    route.params.tab ?? 'codes',
  );

  // The invite page revalidates its summary when it regains focus, so a
  // renamed primary code shows up there without refetching it here.
  const handleCodeUpdated = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Creating a code only belongs to the codes tab.
  const renderHeaderRight = useCallback(
    () =>
      tab === 'codes' ? (
        <CreateCodeButton
          remainingCodes={codeListData?.remainingCodes}
          onCodeCreated={() => {
            void refetch();
          }}
          inviteUrlTemplate={inviteUrl}
        />
      ) : null,
    [codeListData?.remainingCodes, inviteUrl, refetch, tab],
  );

  const tabLabels: Record<IReferralsPageTab, string> = {
    codes: INVITE_COPY.codesTab,
    wallets: intl.formatMessage({ id: ETranslations.global_wallet }),
    orders: intl.formatMessage({ id: ETranslations.referral_referred_type_3 }),
  };

  let content: ReactNode;
  if (tab === 'codes') {
    content = (
      <InviteCodeList
        codeListData={codeListData}
        isLoading={isLoading ?? false}
        onCodeUpdated={handleCodeUpdated}
      />
    );
  } else if (tab === 'wallets') {
    content = <ReferredWalletList />;
  } else {
    content = <ReferredHardwareOrders />;
  }

  return (
    <Page scrollEnabled>
      <Page.Header
        title={INVITE_COPY.referrals}
        headerRight={renderHeaderRight}
      />
      <Page.Body px="$pagePadding" pt="$3" pb="$5" gap="$5">
        <SegmentControl
          fullWidth
          value={tab}
          options={REFERRALS_TABS.map((value) => ({
            value,
            label: tabLabels[value],
          }))}
          onChange={(next) => {
            setTab(next as IReferralsPageTab);
          }}
        />
        {content}
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
