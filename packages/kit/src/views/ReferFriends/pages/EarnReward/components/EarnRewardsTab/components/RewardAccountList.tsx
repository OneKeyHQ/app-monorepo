import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Accordion,
  Divider,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnRewardItem,
  IEarnRewardResponse,
} from '@onekeyhq/shared/src/referralCode/type';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { EmptyData } from '../../EmptyData';

export type IVaultAmount = Record<string, Record<string, string>>;

export const EARN_VAULT_KEY_SEPARATOR = '__';

export const buildVaultKey = (item: IEarnRewardItem) =>
  [
    item.networkId,
    item.provider,
    item.token.symbol,
    item.vaultAddress?.toLowerCase() || '',
  ].join(EARN_VAULT_KEY_SEPARATOR);

export type ISectionData = IEarnRewardResponse['items'][0];

function ListHeader() {
  const intl = useIntl();

  return (
    <XStack ai="center" jc="space-between">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.referral_friends_address,
        })}
      </SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: ETranslations.referral_order_reward,
        })}
      </SizableText>
    </XStack>
  );
}

interface IRewardAccountListProps {
  listData: ISectionData[];
  vaultAmount?: IVaultAmount;
  showDeposited?: boolean;
  headerTitle?: string;
  headerValue?: string | number;
  actions?: ReactNode;
}

export function RewardAccountList({
  listData,
  vaultAmount,
  showDeposited = true,
  headerTitle,
  headerValue,
  actions,
}: IRewardAccountListProps) {
  const intl = useIntl();
  return listData.length > 0 ? (
    <YStack px="$5" py="$2">
      <XStack ai="center" jc="space-between">
        <SizableText size="$headingSm">
          {headerTitle ||
            intl.formatMessage({
              id: ETranslations.referral_referred_type_2,
            })}
        </SizableText>
        {headerValue !== undefined || actions ? (
          <XStack ai="center" gap="$3">
            {headerValue !== undefined ? (
              <Currency formatter="value" size="$headingMd">
                {headerValue}
              </Currency>
            ) : null}
            {actions}
          </XStack>
        ) : null}
      </XStack>
      <Divider my="$3" />
      <YStack>
        <ListHeader />
        <Accordion type="single" collapsible gap="$2">
          {listData.map(({ accountAddress, fiatValue, items }) => (
            <Accordion.Item value={accountAddress} key={accountAddress}>
              <Accordion.Trigger
                unstyled
                flexDirection="row"
                alignItems="center"
                borderWidth={0}
                bg="$transparent"
                px="$2"
                py="$1"
                mx="$-2"
                hoverStyle={{
                  bg: '$bgHover',
                }}
                pressStyle={{
                  bg: '$bgActive',
                }}
                borderRadius="$2"
              >
                {() => (
                  <XStack my="$3" jc="space-between" flex={1}>
                    <SizableText
                      textAlign="left"
                      flex={1}
                      size="$bodyLgMedium"
                      color="$text"
                    >
                      {accountUtils.shortenAddress({
                        address: accountAddress,
                        leadingLength: 6,
                        trailingLength: 4,
                      })}
                    </SizableText>
                    <XStack ai="center" gap="$2">
                      <Currency
                        color="$textSuccess"
                        formatter="value"
                        size="$bodyLgMedium"
                        formatterOptions={{
                          showPlusMinusSigns: true,
                        }}
                      >
                        {fiatValue}
                      </Currency>
                    </XStack>
                  </XStack>
                )}
              </Accordion.Trigger>
              <Accordion.HeightAnimator animation="quick">
                <Accordion.Content
                  unstyled
                  pb="$5"
                  animation="100ms"
                  enterStyle={{ opacity: 0 }}
                  exitStyle={{ opacity: 0 }}
                >
                  {items.map((item, itemIndex) => (
                    <XStack
                      ai="center"
                      jc="space-between"
                      key={itemIndex}
                      py="$2"
                    >
                      <YStack flexShrink={1}>
                        <SizableText size="$bodyMd">
                          {accountUtils.shortenAddress({
                            address: accountAddress,
                            leadingLength: 6,
                            trailingLength: 4,
                          })}
                        </SizableText>
                        {showDeposited ? (
                          <SizableText
                            size="$bodySm"
                            color="$textSubdued"
                            flexShrink={1}
                          >
                            <NumberSizeableText
                              flexShrink={1}
                              formatter="balance"
                              size="$bodySm"
                              color="$textSubdued"
                              formatterOptions={{
                                tokenSymbol: item.token.symbol || '',
                              }}
                            >
                              {vaultAmount?.[accountAddress]?.[
                                buildVaultKey(item)
                              ] || 0}
                            </NumberSizeableText>
                            {` ${intl.formatMessage({
                              id: ETranslations.earn_deposited,
                            })}`}
                          </SizableText>
                        ) : null}
                      </YStack>
                      <XStack
                        ai="center"
                        gap="$2"
                        flexDirection="row"
                        $gtMd={{ gap: '$4' }}
                      >
                        <XStack ai="center">
                          <Token
                            size="xs"
                            tokenImageUri={item.token.logoURI}
                            mr="$2"
                          />
                          <NumberSizeableText
                            formatter="balance"
                            size="$bodyMd"
                            formatterOptions={{
                              tokenSymbol: item.token.symbol || '',
                            }}
                          >
                            {item.amount}
                          </NumberSizeableText>
                        </XStack>
                        <Currency formatter="value" size="$bodyMd">
                          {item.fiatValue}
                        </Currency>
                      </XStack>
                    </XStack>
                  ))}
                </Accordion.Content>
              </Accordion.HeightAnimator>
            </Accordion.Item>
          ))}
        </Accordion>
      </YStack>
    </YStack>
  ) : (
    <EmptyData />
  );
}
