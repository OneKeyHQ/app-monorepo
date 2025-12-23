import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import type { IBorrowToken, IEarnText } from '@onekeyhq/shared/types/staking';

import { FieldWrapper } from './FieldWrapper';

type IAssetFieldToken = Pick<IBorrowToken, 'logoURI' | 'symbol'>;

type IAssetWithAmountFieldProps = {
  token: IAssetFieldToken;
  canBeCollateral?: boolean;
  amountLabel?: string;
  amount?: IEarnText;
  amountDescription?: IEarnText;
  showWalletIcon?: boolean;
};

export const AssetWithAmountField = ({
  token,
  canBeCollateral,
  amountLabel,
  amount,
  amountDescription,
  showWalletIcon,
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
          <XStack ai="center" gap="$1">
            {showWalletIcon ? (
              <Icon name="WalletOutline" size="$3.5" color="$iconSubdued" />
            ) : null}
            {amountLabel ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {amountLabel}
              </SizableText>
            ) : null}
            <EarnText text={amount} size="$bodySm" color="$textSubdued" />
            {amountDescription?.text ? (
              <SizableText size="$bodySm" color="$textSubdued">
                ({amountDescription.text})
              </SizableText>
            ) : null}
          </XStack>
        </YStack>
      </XStack>
    </FieldWrapper>
  );
};
