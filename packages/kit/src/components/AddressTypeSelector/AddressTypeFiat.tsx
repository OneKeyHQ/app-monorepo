import { memo, useMemo } from 'react';

import { find } from 'lodash';

import { NumberSizeableText, XStack, YStack } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { NetworkAvatarBase } from '../NetworkAvatar';

import { useAddressTypeSelectorStableContext } from './AddressTypeSelectorContext';

function AddressTypeFiat({
  accountId,
  xpub,
}: {
  accountId: string | undefined;
  xpub: string | undefined;
}) {
  const [settings] = useSettingsPersistAtom();

  const { tokenMap, networkLogoURI } = useAddressTypeSelectorStableContext();

  const tokenFiat = useMemo(() => {
    if (!tokenMap) {
      return null;
    }
    const result = find(tokenMap, (_, key) => !!(xpub && key.includes(xpub)));
    if (!result) {
      return {
        balanceParsed: '0',
        fiatValue: '0',
      };
    }
    return result;
  }, [tokenMap, xpub]);

  if (!accountId || !tokenFiat) {
    return null;
  }

  return (
    <YStack alignItems="flex-end" userSelect="none">
      <XStack alignItems="center" gap="$1" pb="$0.5">
        <NetworkAvatarBase logoURI={networkLogoURI ?? ''} size={16} />
        <NumberSizeableText
          size="$bodyMdMedium"
          $gtMd={{
            size: '$bodySmMedium',
          }}
          formatter="balance"
        >
          {tokenFiat.balanceParsed}
        </NumberSizeableText>
      </XStack>
      <NumberSizeableText
        size="$bodyMd"
        color="$textSubdued"
        formatter="value"
        formatterOptions={{
          currency: settings.currencyInfo.symbol,
        }}
        $gtMd={{
          size: '$bodySm',
        }}
      >
        {tokenFiat.fiatValue}
      </NumberSizeableText>
    </YStack>
  );
}

export default memo(AddressTypeFiat);
