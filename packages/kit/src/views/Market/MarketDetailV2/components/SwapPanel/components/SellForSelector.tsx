import { useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';

import { TokenSelectorPopover } from './TokenInputSection/TokenSelectorPopover';

import type { IToken } from '../types';

interface ISellForSelectorProps {
  defaultTokens: ISwapTokenBase[];
  currentSelectToken: ISwapTokenBase;
  onTokenSelect: (token: ISwapTokenBase) => void;
  symbol: string;
  isLoading: boolean;
}

const SellForSelector = ({
  defaultTokens,
  currentSelectToken,
  onTokenSelect,
  symbol,
  isLoading: _isLoading,
}: ISellForSelectorProps) => {
  const intl = useIntl();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const hasMultipleTokens = defaultTokens.length > 1;
  return (
    <>
      <XStack
        justifyContent="space-between"
        alignItems="center"
        userSelect="none"
        cursor="default"
      >
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.promode_limit_sell_for,
          })}
        </SizableText>
        <XStack
          alignItems="center"
          gap="$1"
          borderRadius="$2"
          px="$1"
          py="$0.5"
          cursor="default"
          {...(hasMultipleTokens && {
            onPress: () => setIsPopoverOpen(true),
            hoverStyle: { bg: '$bgHover' },
            pressStyle: { bg: '$bgActive' },
          })}
        >
          <SizableText size="$bodySmMedium">{symbol ?? '-'}</SizableText>
          {hasMultipleTokens ? (
            <Icon
              name="ChevronDownSmallOutline"
              size="$4"
              color="$iconSubdued"
              cursor="default"
            />
          ) : null}
        </XStack>
      </XStack>
      <TokenSelectorPopover
        currentSelectToken={currentSelectToken}
        isOpen={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        tokens={defaultTokens as IToken[]}
        onTokenPress={(token) => {
          setIsPopoverOpen(false);
          onTokenSelect(token as ISwapTokenBase);
        }}
        disabledOnSwitchToTrade
      />
    </>
  );
};

export default SellForSelector;
