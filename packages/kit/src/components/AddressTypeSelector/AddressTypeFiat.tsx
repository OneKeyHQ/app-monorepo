import { memo, useMemo } from 'react';

import {
  NumberSizeableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { Currency } from '../Currency';
import { NetworkAvatarBase } from '../NetworkAvatar';

import { useAddressTypeSelectorStableContext } from './AddressTypeSelectorContext';

function AddressTypeFiat({
  account,
}: {
  account: INetworkAccount | undefined;
}) {
  const { tokenMap, networkLogoURI } = useAddressTypeSelectorStableContext();

  const media = useMedia();

  const accountKeyCandidates = useMemo(() => {
    if (!account) {
      return new Set<string>();
    }

    const utxoAccount = account as IDBUtxoAccount;
    const rawCandidates = [
      utxoAccount.xpubSegwit,
      utxoAccount.xpub,
      account.address,
      account.addressDetail.address,
      account.addressDetail.displayAddress,
      account.addressDetail.normalizedAddress,
    ].filter((value): value is string => Boolean(value));

    return new Set(
      rawCandidates.flatMap((value) => [value, value.toLowerCase()]),
    );
  }, [account]);

  const tokenFiat = useMemo(() => {
    if (!tokenMap || accountKeyCandidates.size === 0) {
      return null;
    }

    const result = Object.entries(tokenMap).find(([key]) => {
      const keyArr = key.split('_');
      if (keyArr.length < 3) {
        return false;
      }

      const accountKey = keyArr.slice(1, -1).join('_');
      return (
        accountKeyCandidates.has(accountKey) ||
        accountKeyCandidates.has(accountKey.toLowerCase())
      );
    })?.[1];

    if (!result) {
      return {
        balanceParsed: '0',
        fiatValue: '0',
        currency: undefined as string | undefined,
      };
    }
    return result;
  }, [accountKeyCandidates, tokenMap]);

  if (!account?.id || !tokenFiat) {
    return null;
  }

  return (
    <YStack alignItems="flex-end" userSelect="none">
      <XStack alignItems="center" gap="$1" pb="$0.5">
        <NetworkAvatarBase logoURI={networkLogoURI ?? ''} size={16} />
        <NumberSizeableText
          size={media.gtMd ? '$bodySmMedium' : '$bodyMdMedium'}
          formatter="balance"
        >
          {tokenFiat.balanceParsed}
        </NumberSizeableText>
      </XStack>
      <Currency
        size="$bodyMd"
        color="$textSubdued"
        formatter="value"
        sourceCurrency={tokenFiat.currency}
        $gtMd={{
          size: '$bodySm',
        }}
      >
        {tokenFiat.fiatValue}
      </Currency>
    </YStack>
  );
}

export default memo(AddressTypeFiat);
