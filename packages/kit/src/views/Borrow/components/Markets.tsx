import { XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { useBorrowContext } from '../BorrowProvider';

export const Markets = () => {
  const { market } = useBorrowContext();

  return (
    <XStack mb="$4" h="$14" ai="center" gap="$3">
      <Token
        isNFT
        source={market?.logoURI}
        networkImageUri={market?.network.logoURI}
        size="md"
      />
      <YStack>
        <EarnText
          text={{ text: market?.network.name ?? '' }}
          size="$bodySm"
          color="$textSubdued"
        />
        <EarnText
          text={{ text: market?.name ?? '' }}
          size="$bodyLgMedium"
          color="$textText"
        />
      </YStack>
    </XStack>
  );
};
