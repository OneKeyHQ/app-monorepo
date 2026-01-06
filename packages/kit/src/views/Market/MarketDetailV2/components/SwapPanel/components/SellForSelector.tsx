import { useState } from 'react';

import { useIntl } from 'react-intl';

import type { ISizableTextProps } from '@onekeyhq/components';
import { Icon, SizableText, XStack } from '@onekeyhq/components';
import SwapCommonInfoItem from '@onekeyhq/kit/src/views/Swap/components/SwapCommonInfoItem';
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
  itemTitleProps?: ISizableTextProps;
  itemValueProps?: ISizableTextProps;
}

const SellForSelector = ({
  defaultTokens,
  currentSelectToken,
  onTokenSelect,
  symbol,
  isLoading,
  itemTitleProps,
  itemValueProps,
}: ISellForSelectorProps) => {
  const intl = useIntl();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  return (
    <>
      <SwapCommonInfoItem
        title={intl.formatMessage({
          id: ETranslations.promode_limit_sell_for,
        })}
        valueComponent={
          <XStack
            alignItems="center"
            gap="$1"
            {...(defaultTokens.length > 1
              ? {
                  cursor: 'pointer',
                  onPress: () => setIsPopoverOpen(true),
                  hoverStyle: { opacity: 0.7 },
                  pressStyle: { opacity: 0.5 },
                }
              : {})}
          >
            <SizableText size={itemValueProps?.size ?? '$bodySmMedium'}>
              {symbol ?? '-'}
            </SizableText>
            {defaultTokens.length > 1 ? (
              <Icon
                name="ChevronDownSmallOutline"
                size="$4"
                color="$iconSubdued"
              />
            ) : null}
          </XStack>
        }
        titleProps={itemTitleProps}
        isLoading={isLoading}
        containerProps={{
          py: '$1',
        }}
      />
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
