import type { ReactElement } from 'react';

import { useIntl } from 'react-intl';

import {
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
  items: { title: IListItemTypography; description?: IListItemTypography }[];
};

const ShouldUnderstand = ({ items }: IShouldUnderstandProps) => (
  <YStack flex={1}>
    <ScrollView maxHeight={560}>
      <YStack gap="$5">
        {items.map((o, index) => (
          <ShouldUnderstandListItemListItem
            key={index}
            index={index + 1}
            title={o.title}
            description={o.description}
          />
        ))}
      </YStack>
    </ScrollView>
  </YStack>
);

type IWithdrawShouldUnderstandProps = {
  withdrawalPeriod: number;
};

export const WithdrawShouldUnderstand = ({
  withdrawalPeriod,
}: IWithdrawShouldUnderstandProps) => {
  const intl = useIntl();
  return (
    <ShouldUnderstand
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
