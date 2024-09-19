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

import { capitalizeString } from '../../utils/utils';

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
      <Stack flex={1}>
        <SizableText>{title}</SizableText>
      </Stack>
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

const ShouldUnderstand = ({
  title,
  logoURI,
  subtitle,
  items,
}: IShouldUnderstandProps) => (
  <YStack flex={1}>
    <ScrollView maxHeight={560}>
      <YStack>
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

const createTypography = (text: any, condition: unknown) =>
  condition ? (text as string) : '';

export const StakeShouldUnderstand = ({
  provider,
  logoURI,
  symbol,
  apr,
  updateFrequency,
  receiveSymbol,
  unstakingPeriod,
}: {
  provider: string;
  logoURI?: string;
  symbol: string;
  apr?: string;
  updateFrequency?: string;
  receiveSymbol?: string;
  unstakingPeriod?: number;
}) => {
  const intl = useIntl();
  let items: IListItemTypography[] = [];
  if (provider === 'everstake' && ['sol', 'eth', 'apt'].includes(symbol)) {
    items = [
      createTypography(
        intl.formatMessage(
          { id: ETranslations.earn_earn_up_to_number_per_year },
          { number: <SizableText color="$textSuccess">{apr}%</SizableText> },
        ),
        apr,
      ),
      createTypography(
        intl.formatMessage(
          { id: ETranslations.earn_rewards_updated_around_time },
          {
            time: (
              <SizableText color="$textSuccess">{updateFrequency}</SizableText>
            ),
          },
        ),
        updateFrequency,
      ),
      createTypography(
        intl.formatMessage(
          { id: ETranslations.earn_rewards_automatically_restaked },
          {
            automatically: (
              <SizableText color="$textSuccess">
                {intl.formatMessage({ id: ETranslations.earn_automatically })}
              </SizableText>
            ),
          },
        ),
        true,
      ),
      createTypography(
        intl.formatMessage(
          {
            id: ETranslations.earn_withdrawal_up_to_number_days,
          },
          { number: unstakingPeriod },
        ),
        unstakingPeriod,
      ),
    ];
  } else if (provider === 'everstake' && ['atom', 'matic'].includes(symbol)) {
    items = [
      createTypography(
        intl.formatMessage(
          { id: ETranslations.earn_earn_up_to_number_per_year },
          { number: <SizableText color="$textSuccess">{apr}%</SizableText> },
        ),
        { number: apr },
      ),
      createTypography(
        intl.formatMessage(
          { id: ETranslations.earn_rewards_updated_around_time },
          {
            time: (
              <SizableText color="$textSuccess">{updateFrequency}</SizableText>
            ),
          },
        ),
        updateFrequency,
      ),
      createTypography(
        intl.formatMessage(
          { id: ETranslations.earn_rewards_manually_restaked },
          {
            manually: (
              <SizableText color="$textSuccess">
                {intl.formatMessage({ id: ETranslations.earn_manually })}
              </SizableText>
            ),
          },
        ),
        true,
      ),
      createTypography(
        intl.formatMessage(
          {
            id: ETranslations.earn_withdrawal_up_to_number_days,
          },
          { number: unstakingPeriod },
        ),
        unstakingPeriod,
      ),
    ];
  } else if (provider === 'lido' && ['eth', 'matic'].includes(symbol)) {
    items = [
      createTypography(
        intl.formatMessage(
          { id: ETranslations.earn_earn_up_to_number_per_year },
          { number: <SizableText color="$textSuccess">{apr}%</SizableText> },
        ),
        apr,
      ),
      createTypography(
        intl.formatMessage(
          { id: ETranslations.earn_receive_token_trade_anytime },
          {
            token: (
              <SizableText color="$textSuccess">{receiveSymbol}</SizableText>
            ),
          },
        ),
        receiveSymbol,
      ),
      createTypography(
        intl.formatMessage(
          { id: ETranslations.earn_rewards_updated_around_time },
          {
            time: (
              <SizableText color="$textSuccess">{updateFrequency}</SizableText>
            ),
          },
        ),
        updateFrequency,
      ),
      createTypography(
        intl.formatMessage(
          { id: ETranslations.earn_rewards_automatically_restaked },
          {
            automatically: (
              <SizableText color="$textSuccess">
                {intl.formatMessage({ id: ETranslations.earn_automatically })}
              </SizableText>
            ),
          },
        ),
        true,
      ),
      createTypography(
        intl.formatMessage(
          {
            id: ETranslations.earn_withdrawal_up_to_number_days,
          },
          { number: unstakingPeriod },
        ),
        unstakingPeriod,
      ),
    ];
  } else if (provider === 'babylon') {
    items = [
      intl.formatMessage({
        id: ETranslations.earn_stake_through_onekey_earn_points,
      }),
      intl.formatMessage({
        id: ETranslations.earn_check_staking_results_overflow,
      }),
      createTypography(
        intl.formatMessage(
          { id: ETranslations.earn_early_withdraw_stake_unstaking_period },
          { number: unstakingPeriod },
        ),
        unstakingPeriod,
      ),
    ];
  } else {
    items = [
      createTypography(
        intl.formatMessage(
          { id: ETranslations.earn_earn_up_to_number_per_year },
          {
            number: <SizableText color="$textSuccess">{apr ?? 4}</SizableText>,
          },
        ),
        true,
      ),
    ];
  }
  return (
    <ShouldUnderstand
      logoURI={logoURI}
      title={intl.formatMessage(
        { id: ETranslations.earn_provider_asset_staking },
        {
          'provider': capitalizeString(provider),
          'asset': symbol.toUpperCase(),
        },
      )}
      items={items
        .filter((o) => !!o)
        .map((title) => ({
          title,
        }))}
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
        {
          'provider': capitalizeString(provider),
          'asset': symbol.toUpperCase(),
        },
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
