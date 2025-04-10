import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Divider,
  Empty,
  NumberSizeableText,
  Page,
  SizableText,
  Spinner,
  Stack,
  Tab,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

export default function EarnReward() {
  const intl = useIntl();

  const [amount, setAmount] = useState<
    | {
        available: string;
        pending: string;
      }
    | undefined
  >();
  const [isLoading, setIsLoading] = useState(false);

  const [settings] = useSettingsPersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;

  const { tourTimes, tourVisited } = useSpotlight(
    ESpotlightTour.earnRewardAlert,
  );

  const fetchSales = useCallback((cursor?: string) => {
    return backgroundApiProxy.serviceReferralCode.getEarnReward(cursor);
  }, []);

  const fetchSummaryInfo = useCallback(() => {
    return backgroundApiProxy.serviceReferralCode.getSummaryInfo();
  }, []);

  const onRefresh = useCallback(() => {
    setIsLoading(true);
    void Promise.allSettled([fetchSales(), fetchSummaryInfo()]).then(
      ([salesResult, summaryResult]) => {
        if (salesResult.status === 'fulfilled') {
          const data = salesResult.value;
          // originalData.current.push(...data.items);
        }

        if (summaryResult.status === 'fulfilled') {
          const data = summaryResult.value;
          setAmount({
            available: data.Earn.available?.amount || '0',
            pending: data.Earn.pending?.amount || '0',
          });
        }
        setIsLoading(false);
      },
    );
  }, [fetchSales, fetchSummaryInfo]);

  useEffect(() => {
    onRefresh();
  }, [fetchSales, fetchSummaryInfo, onRefresh]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.referral_earn_reward })}
      />
      <Page.Body>
        {amount === undefined ? (
          <YStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            ai="center"
            jc="center"
            flex={1}
          >
            <Spinner size="large" />
          </YStack>
        ) : (
          <YStack>
            {tourTimes === 0 ? (
              <Alert
                closable
                description={intl.formatMessage({
                  id: ETranslations.referral_earn_reward_tips,
                })}
                type="info"
                mx="$5"
                mb="$2.5"
                onClose={tourVisited}
              />
            ) : null}
            <YStack p="$5" pt={0}>
              <SizableText size="$bodyLg">
                {intl.formatMessage({
                  id: ETranslations.referral_reward_undistributed,
                })}
              </SizableText>
              <NumberSizeableText
                size="$heading5xl"
                formatter="balance"
                formatterOptions={{ currency: currencySymbol }}
              >
                {amount.pending}
              </NumberSizeableText>
              <SizableText mt="$1">
                <NumberSizeableText
                  size="$bodyMdMedium"
                  formatter="balance"
                  formatterOptions={{ currency: currencySymbol }}
                  mr="$1"
                >
                  {amount.available}
                </NumberSizeableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.referral_total_reward,
                  })}
                </SizableText>
              </SizableText>
            </YStack>
            <YStack>
              <Divider />
              <Empty
                icon="GiftOutline"
                title={intl.formatMessage({
                  id: ETranslations.referral_referred_empty,
                })}
                description={intl.formatMessage({
                  id: ETranslations.referral_referred_empty_desc,
                })}
              />
            </YStack>
          </YStack>
        )}
      </Page.Body>
    </Page>
  );
}
