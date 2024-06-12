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

import { LIDO_LOGO_URI } from '../../utils/const';

type IListItemTypography = string | ReactElement;

type IShouldUnderstandListItemProps = {
  title: IListItemTypography;
  description: IListItemTypography;
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
    <XStack pl="$5">
      <SizableText>{description}</SizableText>
    </XStack>
  </YStack>
);

type IShouldUnderstandProps = {
  title: string;
  subtitle?: string;
  items: { title: IListItemTypography; description: IListItemTypography }[];
};

const ShouldUnderstand = ({
  title,
  subtitle,
  items,
}: IShouldUnderstandProps) => (
  <YStack flex={1}>
    <ScrollView maxHeight={560}>
      <YStack py="$5">
        <Stack>
          <Image w="$14" h="$14" src={LIDO_LOGO_URI} />
          <YStack mt="$5">
            <SizableText size="$headingXl">{title}</SizableText>
            {subtitle ? (
              <XStack mt="$5">
                <SizableText size="$bodyLg">{subtitle}</SizableText>
              </XStack>
            ) : null}
          </YStack>
          <YStack mt="$5" space="$5">
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

export const EthWithdrawShouldUnderstand = () => {
  const intl = useIntl();
  return (
    <ShouldUnderstand
      title={intl.formatMessage(
        { id: ETranslations.earn_lido_token_redemption },
        { 'token': 'ETH' },
      )}
      subtitle={intl.formatMessage({
        id: ETranslations.earn_withdrawal_process_desc,
      })}
      items={[
        {
          title: intl.formatMessage({
            id: ETranslations.earn_request_withdrawal,
          }),
          description: intl.formatMessage({
            id: ETranslations.earn_request_withdrawal_steth_desc,
          }),
        },
        {
          title: intl.formatMessage({
            id: ETranslations.earn_receive_lido_nft,
          }),
          description: intl.formatMessage({
            id: ETranslations.earn_receive_lido_nft_desc,
          }),
        },
        {
          title: intl.formatMessage({ id: ETranslations.earn_claim }),
          description: intl.formatMessage(
            {
              id: ETranslations.earn_claim_token_desc,
            },
            { 'token': 'ETH' },
          ),
        },
      ]}
    />
  );
};

export const MaticStakeShouldUnderstand = ({ apr }: { apr: number }) => {
  const intl = useIntl();
  return (
    <ShouldUnderstand
      title={intl.formatMessage(
        { id: ETranslations.earn_lido_token_staking },
        { 'token': 'MATIC' },
      )}
      items={[
        {
          title: (
            <SizableText>
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
                    <SizableText color="$textInteractive">stMatic</SizableText>
                  ),
                },
              )}
            </SizableText>
          ),
          description: intl.formatMessage({
            id: ETranslations.earn_receive_stmatic_desc,
          }),
        },
        {
          title: (
            <SizableText>
              {intl.formatMessage(
                { id: ETranslations.earn_rewards_updated_daily },
                {
                  'daily': (
                    <SizableText color="$textInteractive">daily</SizableText>
                  ),
                },
              )}
            </SizableText>
          ),
          description: intl.formatMessage({
            id: ETranslations.earn_rewards_updated_daily_stmatic_desc,
          }),
        },
      ]}
    />
  );
};

export const MaticWithdrawShouldUnderstand = () => {
  const intl = useIntl();
  return (
    <ShouldUnderstand
      title={intl.formatMessage(
        { id: ETranslations.earn_lido_token_redemption },
        { 'token': 'MATIC' },
      )}
      subtitle={intl.formatMessage({
        id: ETranslations.earn_withdrawal_process_desc,
      })}
      items={[
        {
          title: intl.formatMessage({
            id: ETranslations.earn_request_withdrawal,
          }),
          description: intl.formatMessage({
            id: ETranslations.earn_request_withdrawal_stmatic_desc,
          }),
        },
        {
          title: intl.formatMessage({
            id: ETranslations.earn_receive_lido_nft,
          }),
          description: intl.formatMessage({
            id: ETranslations.earn_receive_lido_nft_desc,
          }),
        },
        {
          title: intl.formatMessage({ id: ETranslations.earn_claim }),
          description: intl.formatMessage(
            {
              id: ETranslations.earn_claim_token_desc,
            },
            { 'token': 'MATIC' },
          ),
        },
      ]}
    />
  );
};
