import { useCallback, useState } from 'react';

import { md5 } from 'js-md5';
import { useIntl } from 'react-intl';

import type { IDialogShowProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Divider,
  Form,
  Input,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
  useForm,
} from '@onekeyhq/components';
import {
  TRON_SOURCE_FLAG_MAINNET,
  TRON_SOURCE_FLAG_TESTNET,
} from '@onekeyhq/core/src/chains/tron/constants';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAccountData } from '../../hooks/useAccountData';
import { usePromiseResult } from '../../hooks/usePromiseResult';

function RewardCenterContent({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const intl = useIntl();

  const form = useForm({
    defaultValues: {
      code: '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const { account, network } = useAccountData({
    accountId,
    networkId,
  });

  const [isClaiming, setIsClaiming] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const claimSource = network?.isTestnet
    ? TRON_SOURCE_FLAG_TESTNET
    : TRON_SOURCE_FLAG_MAINNET;

  const { result, isLoading, run } = usePromiseResult(
    async () => {
      if (!account || !network) {
        return;
      }

      const resp =
        await backgroundApiProxy.serviceAccountProfile.sendProxyRequestWithTrxRes<{
          totalReceivedLimit: number;
          remaining: number;
          isReceived: boolean;
          monthRemain: number;
          monthLimit: number;
          monthIPRemain: number;
          monthIPLimit: number;
          error?: string;
          success: boolean;
        }>({
          networkId,
          body: {
            method: 'post',
            url: '/api/tronRent/isReceived',
            data: {
              fromAddress: account.address,
              sourceFlag: claimSource,
            },
            params: {},
          },
        });

      return resp;
    },
    [account, claimSource, network, networkId],
    {
      watchLoading: true,
    },
  );

  const renderClaimButtonText = useCallback(() => {
    if (
      result?.remaining === 0 ||
      result?.monthRemain === 0 ||
      result?.monthIPRemain === 0
    ) {
      return intl.formatMessage({
        id: ETranslations.wallet_subsidy_all_used,
      });
    }

    if (result?.isReceived) {
      return intl.formatMessage({
        id: ETranslations.wallet_subsidy_claimed,
      });
    }

    return intl.formatMessage({
      id: ETranslations.wallet_subsidy_claim,
    });
  }, [result, intl]);

  const handleClaimResource = useCallback(async () => {
    if (!account || !network) {
      return;
    }

    setIsClaiming(true);

    const timestamp = Date.now();

    const addressUpperCase = account.address.toUpperCase();
    const sign = `${addressUpperCase}${timestamp}${claimSource}${addressUpperCase.slice(
      0,
      4,
    )}${addressUpperCase.slice(
      addressUpperCase.length - 4,
      addressUpperCase.length,
    )}`;
    const signed = md5(sign);

    try {
      const resp =
        await backgroundApiProxy.serviceAccountProfile.sendProxyRequestWithTrxRes<{
          resCode: number;
          resMsg: string;
          success: boolean;
          error?: string;
        }>({
          networkId,
          body: {
            method: 'post',
            url: '/api/tronRent/addFreeTronRentRecord',
            data: {
              fromAddress: account.address,
              sourceFlag: claimSource,
              timestamp,
              signed,
            },
            params: {},
          },
        });

      defaultLogger.reward.tronReward.claimResource({
        networkId,
        address: account.address,
        sourceFlag: claimSource ?? '',
        isSuccess: true,
        resourceType: 'free',
      });

      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.global_success,
        }),
      });
      await run();
      setIsClaiming(false);
      return resp;
    } catch (error) {
      setIsClaiming(false);
    }
  }, [account, claimSource, intl, network, networkId, run]);

  const handleRedeemCode = useCallback(async () => {
    if (!account || !network) {
      return;
    }

    const code = form.getValues('code');

    if (!code) {
      return;
    }

    try {
      const resp =
        await backgroundApiProxy.serviceAccountProfile.sendProxyRequestWithTrxRes<{
          resCode: number;
          resMsg: string;
          success: boolean;
          error?: string;
        }>({
          networkId,
          body: {
            method: 'post',
            url: '/api/v1/coupon/redeem',
            data: {
              fromAddress: account.address,
              code,
              sourceFlag: claimSource,
            },
            params: {},
          },
        });

      defaultLogger.reward.tronReward.redeemResource({
        networkId,
        address: account.address,
        code,
        sourceFlag: claimSource,
        isSuccess: true,
        resourceType: 'code',
      });

      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.global_success,
        }),
      });
      await run();

      setIsRedeeming(false);
      return resp;
    } catch (error) {
      setIsRedeeming(false);
    }
  }, [account, claimSource, form, intl, network, networkId, run]);

  return (
    <Form form={form}>
      <Divider />
      <YStack gap="$4">
        <YStack gap="$2">
          <SizableText size="$headingLg">
            {intl.formatMessage({
              id: ETranslations.wallet_subsidy_label,
            })}
          </SizableText>
          <XStack alignItems="center" justifyContent="space-between">
            {isLoading ? (
              <Skeleton.BodyLg />
            ) : (
              <SizableText size="$bodyLgMedium" color="$textSubdued">
                {intl.formatMessage(
                  {
                    id: ETranslations.wallet_subsidy_remaining,
                  },
                  {
                    remaining: result?.monthRemain,
                    total: result?.monthLimit,
                  },
                )}
              </SizableText>
            )}
            <Button
              size="medium"
              variant="primary"
              loading={isClaiming}
              disabled={
                isLoading ||
                isClaiming ||
                result?.isReceived ||
                result?.remaining === 0 ||
                result?.monthRemain === 0 ||
                result?.monthIPRemain === 0
              }
              onPress={handleClaimResource}
            >
              {renderClaimButtonText()}
            </Button>
          </XStack>
        </YStack>
        <YStack gap="$2">
          <SizableText size="$headingLg">
            {intl.formatMessage({
              id: ETranslations.wallet_redeem_label,
            })}
          </SizableText>
          <Form.Field name="code" rules={{ required: true }}>
            <XStack alignItems="center" justifyContent="space-between" gap="$9">
              <Stack flex={1}>
                <Input
                  w="100%"
                  backgroundColor="$bgStrong"
                  placeholder={intl.formatMessage({
                    id: ETranslations.wallet_enter_redemption_code,
                  })}
                />
              </Stack>
              <Button
                size="medium"
                variant="primary"
                onPress={handleRedeemCode}
                disabled={
                  form.formState.isSubmitting ||
                  !form.formState.isValid ||
                  isRedeeming
                }
              >
                {intl.formatMessage({
                  id: ETranslations.global_ok,
                })}
              </Button>
            </XStack>
          </Form.Field>
        </YStack>
      </YStack>
    </Form>
  );
}

export const showTronRewardCenter = ({
  accountId,
  networkId,
  ...dialogProps
}: IDialogShowProps & {
  accountId: string;
  networkId: string;
}) =>
  Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.wallet_subsidy_redeem_title,
    }),
    tone: 'info',
    description: (
      <SizableText size="$bodyLg" color="$textSubdued">
        {appLocale.intl.formatMessage({
          id: ETranslations.wallet_subsidy_description,
        })}
      </SizableText>
    ),
    icon: 'GiftSolid',
    renderContent: (
      <RewardCenterContent accountId={accountId} networkId={networkId} />
    ),
    showCancelButton: false,
    showConfirmButton: false,
    ...dialogProps,
  });
