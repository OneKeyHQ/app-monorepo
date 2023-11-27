import { YStack } from 'tamagui';

import { Skeleton, Text } from '@onekeyhq/components';

type IProps = {
  address: string;
  value: string;
  isFetchingValue?: boolean;
};

function WalletOverview(props: IProps) {
  const { address, value, isFetchingValue } = props;
  return (
    <YStack paddingHorizontal="$4" paddingVertical="$8" space="$1">
      <Text
        color="$textSubdued"
        width="$16"
        overflow="hidden"
        whiteSpace="nowrap"
        textOverflow="ellipsis"
      >
        {address}
      </Text>
      <Skeleton show={isFetchingValue}>
        <Text variant="$heading4xl">{value}</Text>
      </Skeleton>
    </YStack>
  );
}

export { WalletOverview };
