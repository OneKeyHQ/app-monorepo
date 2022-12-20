import type { ComponentProps } from 'react';

import { Box, HStack, Text } from '@onekeyhq/components';

import { TxActionElementIconLarge } from '../elements/TxActionElementIcon';
import { TxActionElementTitleNormal } from '../elements/TxActionElementTitle';
import { fallbackTextComponent } from '../utils/utilsTxDetail';

import type { ITxActionMetaIcon, ITxActionMetaTitle } from '../types';

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
  } = props;
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
              <Box
                testID="TxListActionBox-subTitleView"
                flex={hasExtraView ? undefined : 1}
              >
                {subTitleView}
              </Box>
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
