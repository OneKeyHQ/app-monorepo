import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { md5 } from 'js-md5';
import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Divider,
  Form,
  Input,
  Page,
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
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EModalRewardCenterRoutes,
  IModalRewardCenterParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountData } from '../../../hooks/useAccountData';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { RouteProp } from '@react-navigation/core';

function RewardCenter() {
  const route =
    useRoute<
      RouteProp<
        IModalRewardCenterParamList,
        EModalRewardCenterRoutes.RewardCenter
      >
    >();

  const { accountId, networkId, onClose } = route?.params ?? {};

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

  const [isResourceClaimed, setIsResourceClaimed] = useState(false);
  const [isResourceRedeemed, setIsResourceRedeemed] = useState(false);

  const [isClaiming, setIsClaiming] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const [isClaimed, setIsClaimed] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const claimSource = network?.isTestnet
    ? TRON_SOURCE_FLAG_TESTNET
    : TRON_SOURCE_FLAG_MAINNET;

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (!account || !network) {
        return;
      }

      const resp =
        await backgroundApiProxy.serviceAccountProfile.sendProxyRequestWithTrxRes<{
          totalReceivedLimit: number;
          remaining: number;
          isReceived: boolean;
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

      setIsClaimed(resp.isReceived);
      setRemaining(resp.remaining);

      return resp;
    },
    [account, claimSource, network, networkId],
    {
      watchLoading: true,
    },
  );

  const renderClaimButtonText = useCallback(() => {
    if (result?.remaining === 0 || result?.totalReceivedLimit === 0) {
      return intl.formatMessage({
        id: ETranslations.wallet_subsidy_all_used,
      });
    }

    if (isClaimed) {
      return intl.formatMessage({
        id: ETranslations.wallet_subsidy_claimed,
      });
    }

    return intl.formatMessage({
      id: ETranslations.wallet_subsidy_claim,
    });
  }, [result?.remaining, result?.totalReceivedLimit, isClaimed, intl]);

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
        resourceType: 'energy',
      });

      setIsClaimed(true);
      setRemaining((v) => new BigNumber(v).minus(1).toNumber());
      setIsResourceClaimed(true);

      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.global_success,
        }),
      });
      setIsClaiming(false);
      return resp;
    } catch (error) {
      setIsClaiming(false);
    }
  }, [account, claimSource, intl, network, networkId]);

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
        resourceType: 'energy',
      });

      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.global_success,
        }),
      });

      setIsRedeeming(false);
      setIsResourceRedeemed(true);
      return resp;
    } catch (error) {
      setIsRedeeming(false);
    }
  }, [account, claimSource, form, intl, network, networkId]);

  useEffect(
    () => () => void onClose?.({ isResourceClaimed, isResourceRedeemed }),
    [onClose, isResourceClaimed, isResourceRedeemed],
  );

  const renderResourceDetails = useCallback(() => {
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
                      remaining,
                      total: result?.totalReceivedLimit,
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
                  isClaimed ||
                  result?.remaining === 0 ||
                  result?.totalReceivedLimit === 0
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
            <XStack alignItems="center" justifyContent="space-between" gap="$9">
              <Stack flex={1}>
                <Form.Field name="code" rules={{ required: true }}>
                  <Input
                    w="100%"
                    backgroundColor="$bgStrong"
                    placeholder={intl.formatMessage({
                      id: ETranslations.wallet_enter_redemption_code,
                    })}
                  />
                </Form.Field>
              </Stack>
              <Button
                size="medium"
                variant="primary"
                onPress={handleRedeemCode}
                loading={isRedeeming}
                disabled={
                  form.formState.isSubmitting ||
                  !form.formState.isValid ||
                  isRedeeming
                }
              >
                {intl.formatMessage({
                  id: ETranslations.wallet_subsidy_claim,
                })}
              </Button>
            </XStack>
          </YStack>
        </YStack>
      </Form>
    );
  }, [
    intl,
    form,
    isLoading,
    isClaiming,
    isClaimed,
    result?.remaining,
    result?.totalReceivedLimit,
    handleClaimResource,
    renderClaimButtonText,
    handleRedeemCode,
    isRedeeming,
    remaining,
  ]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.wallet_subsidy_redeem_title,
        })}
      />
      <Page.Body px="$5">
        <Alert
          type="info"
          icon="InfoCircleOutline"
          title={intl.formatMessage({
            id: ETranslations.wallet_subsidy_description,
          })}
          closable={false}
          mb="$5"
        />
        {renderResourceDetails()}
      </Page.Body>
    </Page>
  );
}

export default RewardCenter;
