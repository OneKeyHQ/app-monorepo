import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { IBorrowToken } from '@onekeyhq/shared/types/staking';

import { FieldWrapper } from './FieldWrapper';

type IAssetFieldToken = Pick<IBorrowToken, 'logoURI' | 'symbol'>;

type IAssetFieldProps = {
  token: IAssetFieldToken;
  canBeCollateral?: boolean;
};

export const AssetField = ({ token, canBeCollateral }: IAssetFieldProps) => {
  return (
    <FieldWrapper flex={1}>
      <XStack ai="center">
        <Token size="md" tokenImageUri={token.logoURI} />
        <YStack>
          <SizableText ml="$3" flex={1} size="$bodyMdMedium" color="$text">
            {token.symbol}
          </SizableText>
        </YStack>
        {canBeCollateral ? (
          <Icon
            br="$1"
            bg="$bgSuccess"
            ml="$2"
            name="Checkmark2SmallOutline"
            size="$5"
            color="$iconSuccess"
          />
        ) : null}
      </XStack>
    </FieldWrapper>
  );
};
