import { useIntl } from 'react-intl';

import {
  Icon,
  LinearGradient,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { showTronRewardCenter } from '@onekeyhq/kit/src/components/RewardCenter/TronRewardCenter';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
          showTronRewardCenter({
            accountId,
            networkId,
            onDialogClose: async ({ isResourceFetched }) => {
              if (isResourceFetched) {
                await timerUtils.wait(1000);
                appEventBus.emit(
                  EAppEventBusNames.EstimateTxFeeRetry,
                  undefined,
                );
              }
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
