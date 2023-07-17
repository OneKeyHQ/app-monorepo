import type { ComponentProps } from 'react';

import { Box, HStack, Text, Token } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';

import { TxActionElementIconLarge } from '../elements/TxActionElementIcon';
import { TxActionElementTitleNormal } from '../elements/TxActionElementTitle';
import { fallbackTextComponent } from '../utils/utilsTxDetail';

import type { ITxActionMetaIcon, ITxActionMetaTitle } from '../types';
import { useAppSelector } from '../../../hooks';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

export type ITxListActionBoxProps = {
  icon?: JSX.Element;
  iconInfo?: ITxActionMetaIcon;
  title?: JSX.Element | string;
  titleInfo?: ITxActionMetaTitle;

  subTitle?: JSX.Element | string;
  content?: JSX.Element | string;
  extra?: JSX.Element | string;
  footer?: JSX.Element | string;

  // v3.13 for defualt token icon
  symbol?: string;
  network?: Network | null;
};
export function TxListActionBoxTitleText(props: ComponentProps<typeof Text>) {
  return <Text typography="Body1Strong" {...props} />;
}
export function TxListActionBoxContentText(props: ComponentProps<typeof Text>) {
  return <Text typography="Body1Strong" textAlign="right" {...props} />;
}
export function TxListActionBoxSubTitleText(
  props: ComponentProps<typeof Text>,
) {
  return <Text typography="Body2" color="text-subdued" {...props} />;
}
export function TxListActionBoxExtraText(props: ComponentProps<typeof Text>) {
  return (
    <Text
      testID="TxListActionBoxExtraText"
      numberOfLines={2}
      isTruncated
      typography="Body2"
      color="text-subdued"
      textAlign="right"
      {...props}
    />
  );
}
export function TxListActionBox(props: ITxListActionBoxProps) {
  const {
    icon,
    iconInfo,
    title,
    titleInfo,
    content,
    extra,
    subTitle,
    footer,
    symbol,
    network,
  } = props;
  const {activeNetworkId} = useAppSelector(s => s.general);
  const titleView = fallbackTextComponent(title, TxListActionBoxTitleText) ?? (
    <TxActionElementTitleNormal titleInfo={titleInfo} />
  );
  const iconView = icon ?? (
    <TxActionElementIconLarge iconInfo={iconInfo} name={symbol} />
  );
  const contentView = fallbackTextComponent(
    content,
    TxListActionBoxContentText,
  );
  const subTitleView = fallbackTextComponent(
    subTitle,
    TxListActionBoxSubTitleText,
  );
  const extraView = fallbackTextComponent(extra, TxListActionBoxExtraText);
  const hasExtraView = !!extraView;
  return (
    <Box>
      <HStack space={2}>
        {iconView ? <Box py="6px">{iconView}</Box> : null}
        <Box flex={1} flexDirection="column" justifyContent="center">
          <HStack space={2} flexDirection="row" justifyContent="space-between">
            <Box maxW={contentView ? '50%' : '100%'}>{titleView}</Box>
            {!!contentView && (
              <Box flex={1} justifyContent="flex-end">
                {contentView}
              </Box>
            )}
          </HStack>
          {Boolean(subTitleView || extraView) && (
            <HStack
              space={2}
              flexDirection="row"
              justifyContent="space-between"
            >
              <HStack
                testID="TxListActionBox-subTitleView"
                flex={hasExtraView ? undefined : 1}
                alignItems="center"
              >
                {isAllNetworks(activeNetworkId) && network?.logoURI ? (
                  <Token
                    token={{ logoURI: network?.logoURI }}
                    showInfo={false}
                    size={4}
                    mr="2px"
                  />
                ) : null}
                {subTitleView}
              </HStack>
              {hasExtraView && (
                <Box testID="TxListActionBox-extraView" flex={1}>
                  {extraView}
                </Box>
              )}
            </HStack>
          )}
        </Box>
      </HStack>
      {footer ? <Box pl="40px">{footer}</Box> : null}
    </Box>
  );
}
