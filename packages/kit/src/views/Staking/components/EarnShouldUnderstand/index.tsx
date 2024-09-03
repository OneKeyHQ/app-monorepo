import type { ReactElement } from 'react';

import { useIntl } from 'react-intl';

import {
  Image,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IListItemTypography = string | ReactElement;

type IShouldUnderstandListItemProps = {
  title: IListItemTypography;
  description?: IListItemTypography;
  index: number;
};

const ShouldUnderstandListItemListItem = ({
  title,
  description,
  index,
}: IShouldUnderstandListItemProps) => (
  <YStack>
    <XStack>
      <Stack w="$5">
        <SizableText>{index}.</SizableText>
      </Stack>
      <SizableText>{title}</SizableText>
    </XStack>
    {description ? (
      <XStack pl="$5">
        <SizableText>{description}</SizableText>
      </XStack>
    ) : null}
  </YStack>
);

type IShouldUnderstandProps = {
  title: string;
  logoURI?: string;
  subtitle?: string;
  items: { title: IListItemTypography; description?: IListItemTypography }[];
};

export const LIDO_LOGO_URI =
  'https://uni.onekey-asset.com/static/logo/Lido.png';

const ShouldUnderstand = ({
  title,
  logoURI,
  subtitle,
  items,
}: IShouldUnderstandProps) => (
  <YStack flex={1}>
    <ScrollView maxHeight={560}>
      <YStack py="$5">
        <Stack>
          <Image w="$14" h="$14" src={logoURI} />
          <YStack mt="$5">
            <SizableText size="$headingXl">{title}</SizableText>
            {subtitle ? (
              <XStack mt="$5">
                <SizableText size="$bodyLg">{subtitle}</SizableText>
              </XStack>
            ) : null}
          </YStack>
          <YStack mt="$5" gap="$5">
            {items.map((o, index) => (
              <ShouldUnderstandListItemListItem
                key={index}
                index={index + 1}
                title={o.title}
                description={o.description}
              />
            ))}
          </YStack>
        </Stack>
      </YStack>
    </ScrollView>
  </YStack>
);

export const EthStakeShouldUnderstand = ({ apr }: { apr: number }) => {
  const intl = useIntl();
  return (
    <ShouldUnderstand
      title={intl.formatMessage(
        { id: ETranslations.earn_lido_token_staking },
        { 'token': 'ETH' },
      )}
      items={[
        {
          title: (
            <SizableText>
              {intl.formatMessage(
                { id: ETranslations.earn_earn_up_to_number_per_year },
                {
                  'number': (
                    <SizableText color="$textInteractive">{apr}%</SizableText>
                  ),
                },
              )}
            </SizableText>
          ),
          description: intl.formatMessage({
            id: ETranslations.earn_earn_up_to_number_per_year_desc,
          }),
        },
        {
          title: (
            <SizableText>
              {intl.formatMessage(
                { id: ETranslations.earn_receive_token },
                {
                  'token': (
                    <SizableText color="$textInteractive">stETH</SizableText>
                  ),
                },
              )}
            </SizableText>
          ),
          description: intl.formatMessage({
            id: ETranslations.earn_receive_steth_desc,
          }),
        },
        {
          title: (
            <SizableText>
              {intl.formatMessage(
                { id: ETranslations.earn_rewards_updated_daily },
                {
                  'daily': (
                    <SizableText color="$textInteractive">
                      {intl.formatMessage({ id: ETranslations.earn_daily })}
                    </SizableText>
                  ),
                },
              )}
            </SizableText>
          ),
          description: intl.formatMessage({
            id: ETranslations.earn_rewards_updated_daily_steth_desc,
          }),
        },
      ]}
    />
  );
};

type IWithdrawShouldUnderstandProps = {
  provider: string;
  logoURI: string;
  symbol: string;
  withdrawalPeriod: number;
};

export const WithdrawShouldUnderstand = ({
  provider,
  symbol,
  logoURI,
  withdrawalPeriod,
}: IWithdrawShouldUnderstandProps) => {
  const intl = useIntl();
  return (
    <ShouldUnderstand
      logoURI={logoURI}
      title={intl.formatMessage(
        { id: ETranslations.earn_provider_asset_withdrawal },
        { 'provider': provider, 'asset': symbol },
      )}
      items={[
        {
          title: intl.formatMessage(
            {
              id: ETranslations.earn_withdrawal_take_up_to_number_days,
            },
            { number: withdrawalPeriod },
          ),
        },
        {
          title: intl.formatMessage({
            id: ETranslations.earn_claim_assets_after_processing,
          }),
        },
      ]}
    />
  );
};
