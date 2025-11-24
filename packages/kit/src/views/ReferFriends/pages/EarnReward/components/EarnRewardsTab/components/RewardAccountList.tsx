import { useIntl } from 'react-intl';

import {
  Accordion,
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
import { ReferFriendsAccordionItem } from '../../ReferFriendsAccordionItem';
import { ReferFriendsListHeader } from '../../ReferFriendsListHeader';

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

interface IRewardAccountListProps {
  listData: ISectionData[];
  vaultAmount?: IVaultAmount;
  showDeposited?: boolean;
}

export function RewardAccountList({
  listData,
  vaultAmount,
  showDeposited = true,
}: IRewardAccountListProps) {
  const intl = useIntl();
  return listData.length > 0 ? (
    <YStack>
      <ReferFriendsListHeader />
      <Accordion type="single" collapsible gap="$2">
        {listData.map(({ accountAddress, fiatValue, items }) => (
          <ReferFriendsAccordionItem
            key={accountAddress}
            value={accountAddress}
            accountAddress={accountAddress}
            fiatValue={fiatValue}
            contentProps={{ p: '$0' }}
          >
            {items.map((item) => {
              const vaultKey = buildVaultKey(item);
              const depositedValue = vaultAmount?.[accountAddress]?.[vaultKey];
              const shouldShowDeposited =
                showDeposited && Number(depositedValue ?? 0) > 0;

              return (
                <XStack ai="center" jc="space-between" key={vaultKey} py="$2">
                  <YStack flexShrink={1}>
                    <SizableText size="$bodyMd">
                      {accountUtils.shortenAddress({
                        address: accountAddress,
                        leadingLength: 6,
                        trailingLength: 4,
                      })}
                    </SizableText>
                    {shouldShowDeposited ? (
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
                          {depositedValue || 0}
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
              );
            })}
          </ReferFriendsAccordionItem>
        ))}
      </Accordion>
    </YStack>
  ) : (
    <EmptyData />
  );
}
