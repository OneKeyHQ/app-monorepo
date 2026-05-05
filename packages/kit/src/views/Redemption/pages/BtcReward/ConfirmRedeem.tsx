import { useCallback, useState } from 'react';

import { CommonActions, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Alert,
  Divider,
  Icon,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalReferFriendsRoutes } from '@onekeyhq/shared/src/routes';
import type { IBtcRewardCodeInfoParam } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { formatUsd } from '../../utils';

import type { RouteProp } from '@react-navigation/core';

type IRouteParams = RouteProp<
  {
    BtcRewardConfirm: {
      codeInfo: IBtcRewardCodeInfoParam;
      voucherCode: string;
      displayTitle: string;
      walletAddress: string;
    };
  },
  'BtcRewardConfirm'
>;

function ConfirmRedeemPage() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route = useRoute<IRouteParams>();
  const { codeInfo, voucherCode, displayTitle, walletAddress } = route.params;
  const { codeId, rewardUsd } = codeInfo;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result =
        await backgroundApiProxy.serviceReferralCode.btcRewardCommit({
          codeId,
          voucherCode,
          walletAddress,
        });

      if (!result.success) {
        defaultLogger.referral.redemption.redeemFailed(
          codeId,
          result.error.message,
        );
        setSubmitError(result.error.message);
        return;
      }

      defaultLogger.referral.redemption.redeemSuccess(codeId);

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: EModalReferFriendsRoutes.BtcRewardSuccess,
              params: {
                rewardUsd,
                walletAddress,
                btcAmount: result.data.btcAmount,
                btcPriceUsd: result.data.btcPriceUsd,
                payoutEligibleAt: result.data.payoutEligibleAt,
              },
            },
          ],
        }),
      );
    } catch {
      setSubmitError(
        intl.formatMessage({
          id: ETranslations.redemption_btc_confirm_error_desc,
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [navigation, codeId, rewardUsd, voucherCode, walletAddress, intl]);

  const handleChangeAddress = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.redemption_btc_confirm_title,
        })}
      />
      <Page.Body px="$5" py="$4">
        <YStack gap="$4">
          <YStack alignItems="center" pb="$4" gap="$1">
            <SizableText size="$bodyLg" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.redemption_btc_confirm_you_will_receive,
              })}
            </SizableText>
            <SizableText size="$heading4xl" color="$text">
              {formatUsd(rewardUsd)}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.redemption_btc_confirm_price_lock_hint_desc,
              })}
            </SizableText>
          </YStack>

          <YStack bg="$bgSubdued" borderRadius="$3" p="$4" gap="$2.5">
            <XStack justifyContent="space-between">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.redemption_btc_label_product,
                })}
              </SizableText>
              <SizableText size="$bodyMdMedium">{displayTitle}</SizableText>
            </XStack>

            <Divider />

            <XStack
              gap="$2"
              alignItems="center"
              onPress={handleChangeAddress}
              pressStyle={{ opacity: 0.7 }}
              cursor="default"
              role="button"
            >
              <Icon name="WalletCryptoSolid" size="$5" color="$icon" />
              <YStack flex={1}>
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.redemption_btc_success_label_to_address,
                  })}
                </SizableText>
                <SizableText size="$bodyMdMedium">
                  {accountUtils.shortenAddress({ address: walletAddress })}
                </SizableText>
              </YStack>
              <XStack gap="$1" alignItems="center">
                <SizableText size="$bodySmMedium" color="$textInfo">
                  {intl.formatMessage({
                    id: ETranslations.redemption_btc_confirm_change_address,
                  })}
                </SizableText>
                <Icon
                  name="ChevronRightSmallOutline"
                  size="$4"
                  color="$iconInfo"
                />
              </XStack>
            </XStack>
          </YStack>

          <Alert
            type="info"
            icon="ClockTimeHistoryOutline"
            title={intl.formatMessage({
              id: ETranslations.redemption_btc_confirm_alert_title,
            })}
            description={intl.formatMessage({
              id: ETranslations.redemption_btc_confirm_alert_desc,
            })}
          />

          {submitError ? (
            <Alert
              type="critical"
              title={intl.formatMessage({
                id: ETranslations.redemption_btc_confirm_error_title,
              })}
              description={submitError}
            />
          ) : null}
        </YStack>
      </Page.Body>

      <Page.Footer
        onConfirm={handleSubmit}
        onConfirmText={intl.formatMessage({
          id: ETranslations.redemption_btc_confirm_submit,
        })}
        confirmButtonProps={{
          loading: isSubmitting,
          disabled: isSubmitting,
        }}
      />
    </Page>
  );
}

export default ConfirmRedeemPage;
