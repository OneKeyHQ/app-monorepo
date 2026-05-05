import { useCallback, useMemo, useState } from 'react';

import { differenceInDays } from 'date-fns';
import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Alert,
  Divider,
  Icon,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { ListItem } from '../../../components/ListItem';
import { Token } from '../../../components/Token';
import { EarnIcon } from '../../Staking/components/ProtocolDetails/EarnIcon';
import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { BorrowNavigation } from '../borrowUtils';

export const BorrowBonusTooltip = ({
  data,
  accountId,
  networkId,
  provider,
  marketAddress,
}: {
  data?: IBorrowReserveItem['overview']['platformBonus'];
  accountId?: string;
  networkId?: string;
  provider?: string;
  marketAddress?: string;
}) => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [open, setOpen] = useState(false);

  const handleHistoryClick = useCallback(() => {
    if (!accountId || !networkId || !provider || !marketAddress) return;
    setOpen(false);
    BorrowNavigation.pushToBorrowHistory(navigation, {
      accountId,
      networkId,
      provider,
      marketAddress,
      title: intl.formatMessage({ id: ETranslations.global_history }),
      type: 'platformBonus',
    });
  }, [accountId, networkId, provider, marketAddress, intl, navigation]);

  const itemRender = useCallback(
    ({
      children,
      key,
      needDivider,
    }: {
      children: React.ReactNode;
      key: string | number;
      needDivider?: boolean;
    }) => {
      return (
        <>
          <ListItem
            my="$2"
            key={key}
            ai="center"
            jc="space-between"
            borderWidth="$0"
            px="$0"
            mx="$0"
          >
            {children}
          </ListItem>
          {needDivider ? <Divider mx="$5" my="$2.5" /> : null}
        </>
      );
    },
    [],
  );

  const endsInDays = useMemo(() => {
    if (!data?.data?.endsIn) return '';

    const days = differenceInDays(data.data.endsIn, new Date());

    return String(Math.max(0, days));
  }, [data?.data?.endsIn]);

  if (!data) {
    return null;
  }

  return (
    <XStack flexShrink={0}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        placement="bottom-end"
        renderTrigger={
          <XStack cursor="pointer" ai="center" gap="$1">
            <EarnText
              size="$bodySmMedium"
              color="$textSubdued"
              text={{
                text: intl.formatMessage({ id: ETranslations.global_details }),
              }}
            />
            <Icon size="$4" name="InfoCircleOutline" color="$iconSubdued" />
          </XStack>
        }
        title={intl.formatMessage({ id: ETranslations.defi_platform_bonus })}
        renderContent={
          <YStack p="$5" overflow="hidden" borderRadius="$3">
            {/* Total received header with History button */}
            <XStack mb="$3" jc="space-between" ai="center">
              <YStack gap="$1.5" w="100%">
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.wallet_total_received,
                  })}
                </SizableText>
                <XStack jc="space-between">
                  <EarnText
                    text={data.totalReceived.description}
                    size="$headingXl"
                    color="$text"
                  />
                  {data.totalReceived.button ? (
                    <XStack
                      ai="center"
                      gap="$1"
                      cursor="pointer"
                      onPress={handleHistoryClick}
                    >
                      <EarnText
                        text={data.totalReceived.button.text}
                        size="$bodyMd"
                        color="$textSubdued"
                      />
                      <Icon
                        name="ChevronRightSmallOutline"
                        size="$4"
                        color="$iconSubdued"
                      />
                    </XStack>
                  ) : null}
                </XStack>
              </YStack>
            </XStack>

            {/* Alerts section */}
            {!isEmpty(data?.alerts) ? (
              <YStack gap="$2" mb="$5" mt="$2">
                {data.alerts?.map((alert, index) => (
                  <Alert
                    key={`alert-${index}`}
                    type={alert.badge}
                    renderTitle={(props) => (
                      <EarnText {...props} text={alert.title} />
                    )}
                    descriptionComponent={
                      alert.description ? (
                        <EarnText
                          text={alert.description}
                          size="$bodyMd"
                          color="$textSubdued"
                        />
                      ) : null
                    }
                  />
                ))}
              </YStack>
            ) : null}

            {/* Divider - only show when distributed or undistributed has items */}
            {!isEmpty(data?.distributed) || !isEmpty(data?.undistributed) ? (
              <Divider mb="$3" />
            ) : null}

            {/* Distributed section */}
            {isEmpty(data?.distributed) ? null : (
              <>
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.referral_distributed,
                  })}
                </SizableText>
                {data?.distributed?.map((item, index) => {
                  return itemRender({
                    key: `distributed-${index}-${item?.token?.address}`,
                    children: (
                      <>
                        <XStack ai="center" gap="$2.5">
                          <Token size="sm" tokenImageUri={item.token.logoURI} />
                          <EarnText
                            size="$bodyMdMedium"
                            color="$text"
                            text={item.title}
                          />
                        </XStack>
                        <EarnText
                          size="$bodyMd"
                          color="$textSubdued"
                          text={item.description}
                        />
                      </>
                    ),
                  });
                })}
              </>
            )}

            {/* Undistributed section */}
            {isEmpty(data?.undistributed) ? null : (
              <>
                <SizableText
                  size="$bodySmMedium"
                  color="$textSubdued"
                  mt="$2.5"
                >
                  {intl.formatMessage({
                    id: ETranslations.earn_referral_undistributed,
                  })}
                </SizableText>
                {data?.undistributed?.map((item, index) => {
                  return itemRender({
                    key: `undistributed-${index}-${item?.token?.address}`,
                    children: (
                      <>
                        <XStack ai="center" gap="$2.5">
                          <Token size="sm" tokenImageUri={item.token.logoURI} />
                          <EarnText
                            size="$bodyMdMedium"
                            color="$text"
                            text={item.title}
                          />
                        </XStack>
                        <EarnText
                          size="$bodyMd"
                          color="$textSubdued"
                          text={item.description}
                        />
                      </>
                    ),
                  });
                })}
              </>
            )}

            {/* Description text - always show when description exists */}
            {data.description ? (
              <YStack mt="$2">
                <EarnText
                  size="$bodySm"
                  color="$textSubdued"
                  text={data.description}
                />
                <Divider mt="$5" mb="$3.5" />
              </YStack>
            ) : null}
            <Stack>
              <YStack gap="$3">
                {/* Platform bonus info card */}
                <XStack ai="center">
                  <EarnIcon
                    icon={{
                      icon: 'Ai2StarSolid',
                      color: '$success10',
                      size: '$3.5',
                    }}
                    mr="$1.5"
                  />
                  <EarnText
                    size="$bodySmMedium"
                    color="$textSubdued"
                    text={data.data.title}
                  />
                  <Divider vertical h="$3" mx="$3" />
                  <SizableText size="$bodySmMedium" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.earn_event_ends_in,
                    })}
                  </SizableText>
                  <EarnText
                    size="$bodySmMedium"
                    color="$textSuccess"
                    ml="$1"
                    text={{
                      text: intl.formatMessage(
                        { id: ETranslations.earn_number_days },
                        { number: endsInDays },
                      ),
                    }}
                  />
                </XStack>
                {!isEmpty(data.data.rewards) ? (
                  <YStack jc="center">
                    {data.data.rewards.map((reward, index) => {
                      return (
                        <XStack gap="$1.5" key={index} ai="center">
                          <Token size="xxs" tokenImageUri={reward.logoURI} />
                          <EarnText
                            text={reward.type}
                            size="$bodyMd"
                            color="$text"
                          />
                          <EarnText
                            text={reward.title}
                            size="$bodyMdMedium"
                            color="$text"
                          />
                          <EarnText
                            text={reward.description}
                            size="$bodyMdMedium"
                            color="$textSubdued"
                          />
                        </XStack>
                      );
                    })}
                  </YStack>
                ) : null}
                {data.data.button ? (
                  <XStack
                    gap="$0.5"
                    cursor="pointer"
                    onPress={() => openUrlExternal(data.data.button.data.link)}
                  >
                    <EarnText
                      text={data.data.button.text}
                      size="$bodyMdMedium"
                      color="$textSubdued"
                    />
                  </XStack>
                ) : null}
              </YStack>
            </Stack>
          </YStack>
        }
      />
    </XStack>
  );
};
