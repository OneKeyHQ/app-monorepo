import { useIntl } from 'react-intl';

import {
  Icon,
  LinearGradient,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSignatureConfirmActions } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalRewardCenterRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

function ClaimResourceEntry({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { updateTronResourceRentalInfo } = useSignatureConfirmActions().current;
  return (
    <LinearGradient
      colors={['#63c811', '#00a3ff']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ borderRadius: 32, padding: 2 }}
    >
      <XStack
        {...listItemPressStyle}
        alignItems="center"
        gap={2}
        borderRadius="$8"
        px={8}
        py={2}
        backgroundColor="$bgApp"
        onPress={() => {
          navigation.pushModal(EModalRoutes.MainModal, {
            screen: EModalRewardCenterRoutes.RewardCenter,
            params: {
              accountId,
              networkId,
              showAccountSelector: false,
              onClose: async ({ isResourceClaimed, isResourceRedeemed }) => {
                if (isResourceClaimed || isResourceRedeemed) {
                  await timerUtils.wait(1000);
                  updateTronResourceRentalInfo({
                    isResourceClaimed,
                    isResourceRedeemed,
                  });
                  appEventBus.emit(
                    EAppEventBusNames.EstimateTxFeeRetry,
                    undefined,
                  );
                }
              },
            },
          });
        }}
        cursor="pointer"
      >
        <Icon name="GiftSolid" size="$3" color="$iconSubdued" />
        <SizableText size="$bodySmMedium" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.wallet_trx_free_credit,
          })}
        </SizableText>
      </XStack>
    </LinearGradient>
  );
}

export default ClaimResourceEntry;
