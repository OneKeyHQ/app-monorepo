import { Icon, Image, SizableText, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import type { IBorrowToken, IEarnText } from '@onekeyhq/shared/types/staking';

import { FieldWrapper } from './FieldWrapper';

type IAssetFieldToken = Pick<IBorrowToken, 'logoURI' | 'symbol'>;

type IAssetFieldProps = {
  token: IAssetFieldToken;
  canBeCollateral?: boolean;
  platformBonusApy?: {
    title: IEarnText;
    logoURI: string;
  };
};

export const AssetField = ({
  token,
  canBeCollateral,
  platformBonusApy,
}: IAssetFieldProps) => {
  return (
    <FieldWrapper flex={1}>
      <XStack ai="center">
        <Token size="md" tokenImageUri={token.logoURI} />
        <YStack ml="$3" flex={1} gap="$0.5">
          <XStack ai="center">
            <SizableText size="$bodyMdMedium" color="$text">
              {token.symbol}
            </SizableText>
            {canBeCollateral ? (
              <Icon
                br="$1"
                bg="$bgSuccess"
                ml="$2"
                name="Checkmark2SmallOutline"
                size="$5"
                w="$5"
                h="$5"
                flexShrink={0}
                color="$iconSuccess"
              />
            ) : null}
          </XStack>
          {platformBonusApy ? (
            <XStack ai="center" gap="$1">
              <EarnText
                text={platformBonusApy.title}
                size="$bodySmMedium"
                color="$textSuccess"
                whiteSpace="nowrap"
              />
              <Image
                src={platformBonusApy.logoURI}
                width="$3.5"
                height="$3.5"
              />
            </XStack>
          ) : null}
        </YStack>
      </XStack>
    </FieldWrapper>
  );
};
