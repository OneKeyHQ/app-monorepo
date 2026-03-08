import { Icon, Image, SizableText, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import type { IBorrowToken, IEarnText } from '@onekeyhq/shared/types/staking';

import { FieldWrapper } from './FieldWrapper';

type IAssetFieldToken = Pick<IBorrowToken, 'logoURI' | 'symbol'>;

type IAssetWithAmountFieldProps = {
  token: IAssetFieldToken;
  canBeCollateral?: boolean;
  amountLabel?: IEarnText;
  amount?: IEarnText;
  amountDescription?: IEarnText;
  showWalletIcon?: boolean;
  platformBonusApy?: {
    title: IEarnText;
    logoURI: string;
  };
};

export const AssetWithAmountField = ({
  token,
  canBeCollateral,
  amountLabel,
  amount,
  amountDescription,
  showWalletIcon,
  platformBonusApy,
}: IAssetWithAmountFieldProps) => {
  return (
    <FieldWrapper flex={1}>
      <XStack ai="center">
        <Token size="md" tokenImageUri={token.logoURI} />
        <YStack ml="$3" gap="$0.5">
          <XStack ai="center" gap="$1">
            <SizableText size="$bodyMdMedium" color="$text">
              {token.symbol}
            </SizableText>
            {canBeCollateral ? (
              <Icon
                br="$1"
                bg="$bgSuccess"
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
          <XStack ai="center" gap="$1">
            {showWalletIcon ? (
              <Icon name="WalletOutline" size="$3.5" color="$iconSubdued" />
            ) : null}
            <EarnText text={amountLabel} size="$bodySm" color="$textSubdued" />
            <EarnText text={amount} size="$bodySm" color="$textSubdued" />
            {amountDescription ? (
              <EarnText
                text={{ text: `(${amountDescription.text})` }}
                size="$bodySm"
                color="$textSubdued"
              />
            ) : null}
          </XStack>
        </YStack>
      </XStack>
    </FieldWrapper>
  );
};
