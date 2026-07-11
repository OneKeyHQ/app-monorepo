import { SizableText, Skeleton, YStack } from '@onekeyhq/components';

import { HomeTestIDs } from '../../testIDs';

type IProps = {
  address: string;
  value: string;
  isFetchingValue?: boolean;
};

function WalletOverview(props: IProps) {
  const { address, value, isFetchingValue } = props;
  return (
    <YStack
      paddingHorizontal="$4"
      paddingVertical="$8"
      gap="$1"
      testID={HomeTestIDs.walletOverview}
    >
      <SizableText
        color="$textSubdued"
        width="$16"
        overflow="hidden"
        whiteSpace="nowrap"
        textOverflow="ellipsis"
      >
        {address}
      </SizableText>
      <Skeleton show={isFetchingValue}>
        <SizableText size="$heading4xl">{value}</SizableText>
      </Skeleton>
    </YStack>
  );
}

export { WalletOverview };
