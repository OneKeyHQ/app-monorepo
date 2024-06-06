import {
  Image,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { LIDO_LOGO_URI } from '../../utils/const';

type IShouldUnderstandListItemProps = {
  title: string;
  description: string;
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
  items: { title: string; description: string }[];
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

export const EthStakeShouldUnderstand = () => (
  <ShouldUnderstand
    title="Lido ETH Staking"
    items={[
      {
        title: 'Earn up to 3.67% per year',
        description:
          'The APR is updated hourly and adjusted according to changes in TVL',
      },
      {
        title: 'Receive stETH',
        description:
          'When you stake ETH you receive 1:1 stETH. You can unstake and trade this liquid asset at any time',
      },
      {
        title: 'Rewards updated daily',
        description:
          "There'll be a daily update on your stETH balances, which includes the staking rewards.",
      },
    ]}
  />
);

export const EthWithdrawShouldUnderstand = () => (
  <ShouldUnderstand
    title="Lido ETH redemption"
    subtitle="The withdrawal process is simple and will be divided into the following steps:"
    items={[
      {
        title: 'Request Withdrawal',
        description:
          'Lock your stETH/wstETH by issuing a withdrawal request. After 1-5 days, the locked stETH will be destroyed and your ETH will become available for withdrawal.',
      },
      {
        title: 'Receive Lido NFT',
        description:
          'Each withdrawal request generates a Lido NFT, and its appearance changes when your ETH becomes available for withdrawal.',
      },
      {
        title: 'Claim',
        description:
          'Claim your ETH after the withdrawal request has been processed.',
      },
    ]}
  />
);

export const MaticStakeShouldUnderstand = () => (
  <ShouldUnderstand
    title="Lido MATIC Staking"
    items={[
      {
        title: 'Earn up to 3.67% per year',
        description:
          'The APR is updated hourly and adjusted according to changes in TVL',
      },
      {
        title: 'Receive stMATIC',
        description:
          'When you stake MATIC you receive stMATIC. You can unstake and trade this liquid asset at any time.',
      },
      {
        title: 'Rewards updated daily',
        description:
          'During the staking period, the value of stMATIC changes to reflect earnings',
      },
    ]}
  />
);

export const MaticWithdrawShouldUnderstand = () => (
  <ShouldUnderstand
    title="Lido MATIC redemption"
    subtitle="The withdrawal process is simple and will be divided into the following steps:"
    items={[
      {
        title: 'Request Withdrawal',
        description:
          '1-5 days after issuing a withdrawal request, the locked stMATIC will be destroyed and your MATIC will become available for withdrawal.',
      },
      {
        title: 'Receive Lido NFT',
        description:
          'Each withdrawal request generates a Lido NFT, and its appearance changes when your MATIC becomes available for withdrawal.',
      },
      {
        title: 'Claim',
        description:
          'Claim your MATIC after the withdrawal request has been processed.',
      },
    ]}
  />
);
