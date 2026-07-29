import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, ScrollView, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSwapRoutes,
  IModalSwapParamList,
} from '@onekeyhq/shared/src/routes/swap';

import { SwapInviteeRewardContent } from '../../components/InviteeReward/SwapInviteeRewardContent';

import type { RouteProp } from '@react-navigation/core';

export default function SwapInviteeRewardModal() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<IModalSwapParamList, EModalSwapRoutes.SwapInviteeReward>
    >();

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.referral_swap_reward,
        })}
      />
      <Page.Body>
        <ScrollView flex={1}>
          <YStack flex={1}>
            <SwapInviteeRewardContent
              accountId={route.params?.accountId}
              isMobile
            />
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}
