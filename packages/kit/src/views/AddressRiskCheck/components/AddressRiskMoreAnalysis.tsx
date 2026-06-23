import { useCallback, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Divider,
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAddressRiskCheckDetails } from '@onekeyhq/shared/types/addressRiskCheck';

import { formatRiskCheckDate } from './RiskCheckShared';

function SectionHeader({ title, extra }: { title: string; extra?: string }) {
  return (
    <XStack ai="center" jc="space-between" gap="$3">
      <SizableText size="$headingSm" color="$textSubdued">
        {title}
      </SizableText>
      {extra ? (
        <SizableText size="$bodyMdMedium" color="$textSubdued">
          {extra}
        </SizableText>
      ) : null}
    </XStack>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <YStack
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      overflow="hidden"
    >
      {children}
    </YStack>
  );
}

function ActivityCell({
  icon,
  label,
  value,
  withDivider,
}: {
  icon: IKeyOfIcons;
  label: string;
  value: string;
  withDivider?: boolean;
}) {
  return (
    <XStack
      flexGrow={1}
      flexShrink={1}
      flexBasis={0}
      ai="center"
      gap="$2"
      px="$3"
      py="$2.5"
      minWidth={0}
      {...(withDivider && {
        borderRightWidth: StyleSheet.hairlineWidth,
        borderRightColor: '$borderSubdued',
      })}
    >
      <Stack
        w={30}
        h={30}
        ai="center"
        jc="center"
        borderRadius="$full"
        bg="$bgStrong"
      >
        <Icon name={icon} size="$5" color="$iconSubdued" />
      </Stack>
      <YStack flex={1} gap="$0.5" minWidth={0}>
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {label}
        </SizableText>
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {value}
        </SizableText>
      </YStack>
    </XStack>
  );
}

const RISK_INTELLIGENCE_CATEGORY_TITLE: Partial<
  Record<keyof IAddressRiskCheckDetails['riskIntelligence'], ETranslations>
> = {
  phishing: ETranslations.address_risk_check_phishing__title,
  ransom: ETranslations.address_risk_check_ransom__title,
  theft: ETranslations.address_risk_check_theft__title,
  laundering: ETranslations.address_risk_check_laundering__title,
};

function AddressActivityBlock({
  activity,
}: {
  activity: IAddressRiskCheckDetails['activity'];
}) {
  const intl = useIntl();
  const total = activity.receivedTxs + activity.sentTxs;
  const receivedPercent = total > 0 ? (activity.receivedTxs / total) * 100 : 0;
  const sentPercent = total > 0 ? 100 - receivedPercent : 0;
  const receivedPercentText = `${new BigNumber(receivedPercent).toFixed(1)}%`;
  const sentPercentText = `${new BigNumber(sentPercent).toFixed(1)}%`;

  return (
    <YStack gap="$2.5">
      <SectionHeader
        title={intl.formatMessage({
          id: ETranslations.address_risk_check_address_activity__title,
        })}
        extra={intl.formatMessage(
          { id: ETranslations.address_risk_check_txs__msg },
          { count: activity.totalTxs },
        )}
      />
      <Card>
        <XStack ai="stretch">
          <ActivityCell
            withDivider
            icon="CalendarOutline"
            label={intl.formatMessage({
              id: ETranslations.address_risk_check_first_active__title,
            })}
            value={formatRiskCheckDate(activity.firstActiveAt)}
          />
          <ActivityCell
            icon="CalendarOutline"
            label={intl.formatMessage({
              id: ETranslations.address_risk_check_last_active__title,
            })}
            value={formatRiskCheckDate(activity.lastActiveAt)}
          />
        </XStack>
        <Divider />
        <XStack ai="stretch">
          <ActivityCell
            withDivider
            icon="SwitchVerOutline"
            label={intl.formatMessage({
              id: ETranslations.address_risk_check_received_sent__title,
            })}
            value={`${activity.receivedTxs} / ${activity.sentTxs}`}
          />
          <ActivityCell
            icon="CoinsOutline"
            label={intl.formatMessage({ id: ETranslations.global_balance })}
            value={`${activity.balance} ${activity.balanceSymbol}`}
          />
        </XStack>
        <Divider />
        <YStack px="$3" pt="$2.5" pb="$4" gap="$0.5">
          <XStack jc="space-between">
            <SizableText size="$bodySmMedium" color="$textSuccess">
              {`${intl.formatMessage({
                id: ETranslations.address_risk_check_received__title,
              })} ${receivedPercentText}`}
            </SizableText>
            <SizableText size="$bodySmMedium" color="$textInfo">
              {`${intl.formatMessage({
                id: ETranslations.address_risk_check_sent__title,
              })} ${sentPercentText}`}
            </SizableText>
          </XStack>
          <XStack height={6} gap="$0.5">
            <Stack
              flexGrow={receivedPercent}
              bg="$iconSuccess"
              borderTopLeftRadius="$full"
              borderBottomLeftRadius="$full"
            />
            <Stack
              flexGrow={sentPercent}
              bg="$iconInfo"
              borderTopRightRadius="$full"
              borderBottomRightRadius="$full"
            />
          </XStack>
        </YStack>
      </Card>
    </YStack>
  );
}

function ExchangeChip({ name }: { name: string }) {
  return (
    <XStack
      ai="center"
      jc="center"
      minWidth={36}
      px="$2"
      py="$1"
      bg="$bgStrong"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$full"
    >
      <SizableText size="$bodySmMedium">{name}</SizableText>
    </XStack>
  );
}

function PlatformProfileBlock({
  platformProfile,
}: {
  platformProfile: IAddressRiskCheckDetails['platformProfile'];
}) {
  const intl = useIntl();
  const { exchanges, dex, mixer, nft } = platformProfile;
  const noOtherSignals =
    dex.count === 0 && mixer.count === 0 && nft.count === 0;

  return (
    <YStack gap="$2.5">
      <SectionHeader
        title={intl.formatMessage({
          id: ETranslations.address_risk_check_platform_profile__title,
        })}
        extra={intl.formatMessage(
          { id: ETranslations.address_risk_check_exchanges__msg },
          { count: exchanges.count },
        )}
      />
      <Card>
        <YStack px="$4" py="$3" gap="$2">
          {exchanges.list.length ? (
            <XStack flexWrap="wrap" gap="$2">
              {exchanges.list.map((name) => (
                <ExchangeChip key={name} name={name} />
              ))}
            </XStack>
          ) : null}
          <XStack ai="center" gap="$1.5">
            <Stack w={6} h={6} borderRadius="$full" bg="$iconSubdued" />
            <SizableText size="$bodyMd" color="$textSubdued">
              {noOtherSignals
                ? intl.formatMessage({
                    id: ETranslations.address_risk_check_no_platform_signals__desc,
                  })
                : intl.formatMessage(
                    {
                      id: ETranslations.address_risk_check_platform_signals__msg,
                    },
                    {
                      dexCount: dex.count,
                      mixerCount: mixer.count,
                      nftCount: nft.count,
                    },
                  )}
            </SizableText>
          </XStack>
        </YStack>
      </Card>
    </YStack>
  );
}

function RiskIntelligenceBlock({
  riskIntelligence,
}: {
  riskIntelligence: IAddressRiskCheckDetails['riskIntelligence'];
}) {
  const intl = useIntl();
  const entries = (
    Object.keys(riskIntelligence) as Array<keyof typeof riskIntelligence>
  )
    .map((key) => ({ key, ...riskIntelligence[key] }))
    .filter((item) => item.count > 0);
  const totalSignals = entries.reduce((sum, item) => sum + item.count, 0);
  const getCategoryTitle = (
    key: keyof IAddressRiskCheckDetails['riskIntelligence'],
  ) => {
    const titleId = RISK_INTELLIGENCE_CATEGORY_TITLE[key];
    return titleId ? intl.formatMessage({ id: titleId }) : key;
  };

  if (!entries.length) {
    return null;
  }

  return (
    <YStack gap="$2.5">
      <SectionHeader
        title={intl.formatMessage({
          id: ETranslations.address_risk_check_risk_intelligence__title,
        })}
        extra={intl.formatMessage(
          { id: ETranslations.address_risk_check_signals__msg },
          { count: totalSignals },
        )}
      />
      <Card>
        {entries.map((item, index) => (
          <YStack key={item.key}>
            {index > 0 ? <Divider /> : null}
            <XStack px="$4" py="$2.5" ai="center" jc="space-between" gap="$2">
              <YStack gap="$0.5" minWidth={0}>
                <SizableText size="$bodyMdMedium">
                  {getCategoryTitle(item.key)}
                </SizableText>
                {item.list.length ? (
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {item.list.join(', ')}
                  </SizableText>
                ) : null}
              </YStack>
              <SizableText size="$bodyMdMedium" textAlign="right">
                {intl.formatMessage(
                  { id: ETranslations.address_risk_check_signals__msg },
                  { count: item.count },
                )}
              </SizableText>
            </XStack>
          </YStack>
        ))}
      </Card>
    </YStack>
  );
}

export function AddressRiskMoreAnalysis({
  networkId,
  address,
}: {
  networkId: string;
  address: string;
}) {
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(false);
  const [details, setDetails] = useState<
    IAddressRiskCheckDetails | undefined
  >();

  const handleLoad = useCallback(async () => {
    setIsLoading(true);
    try {
      const data =
        await backgroundApiProxy.serviceAddressRiskCheck.getAddressRiskDetails({
          networkId,
          address,
        });
      setDetails(data);
    } catch {
      // The background proxy already shows the server-provided error toast.
    } finally {
      setIsLoading(false);
    }
  }, [networkId, address]);

  if (!details) {
    return (
      <XStack
        role="button"
        testID="address-risk-check-more-analysis"
        ai="center"
        jc="space-between"
        gap="$2"
        px="$4"
        height={50}
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        disabled={isLoading}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        onPress={handleLoad}
      >
        <SizableText size="$bodyLgMedium">
          {intl.formatMessage({
            id: ETranslations.address_risk_check_more_analysis__action,
          })}
        </SizableText>
        {isLoading ? (
          <Spinner size="small" />
        ) : (
          <Icon
            name="ChevronRightSmallOutline"
            size="$5"
            color="$iconSubdued"
          />
        )}
      </XStack>
    );
  }

  return (
    <YStack gap="$5">
      <AddressActivityBlock activity={details.activity} />
      <PlatformProfileBlock platformProfile={details.platformProfile} />
      <RiskIntelligenceBlock riskIntelligence={details.riskIntelligence} />
    </YStack>
  );
}
