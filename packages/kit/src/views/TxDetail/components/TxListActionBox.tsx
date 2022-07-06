import React, { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Box, HStack, Text } from '@onekeyhq/components';
import {
  IDecodedTx,
  IDecodedTxStatus,
  IHistoryTx,
} from '@onekeyhq/engine/src/vaults/types';

import { TxActionElementIconLarge } from '../elements/TxActionElementIcon';
import { TxActionElementReplacedTxText } from '../elements/TxActionElementReplacedTxText';
import { TxActionElementStatusText } from '../elements/TxActionElementStatusText';
import { TxActionElementTitleNormal } from '../elements/TxActionElementTitle';
import { ITxActionMetaIcon, ITxActionMetaTitle } from '../types';
import { fallbackTextComponent, getTxStatusInfo } from '../utils/utilsTxDetail';

export type ITxListActionBoxProps = {
  icon?: JSX.Element;
  title?: JSX.Element | string;
  titleInfo?: ITxActionMetaTitle;
  iconInfo?: ITxActionMetaIcon;

  subTitle?: JSX.Element | string;
  content?: JSX.Element | string;
  extra?: JSX.Element | string;
  footer?: JSX.Element | string;
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
      typography="Body2"
      color="text-subdued"
      textAlign="right"
      {...props}
    />
  );
}
export function TxListActionBox(props: ITxListActionBoxProps) {
  const { icon, iconInfo, title, titleInfo, content, extra, subTitle, footer } =
    props;
  const titleView = fallbackTextComponent(title, TxListActionBoxTitleText) ?? (
    <TxActionElementTitleNormal titleInfo={titleInfo} />
  );
  const iconView = icon ?? <TxActionElementIconLarge iconInfo={iconInfo} />;
  const contentView = fallbackTextComponent(
    content,
    TxListActionBoxContentText,
  );
  const subTitleView = fallbackTextComponent(
    subTitle,
    TxListActionBoxSubTitleText,
  );
  const extraView = fallbackTextComponent(extra, TxListActionBoxExtraText);

  return (
    <Box>
      <HStack space={2}>
        {iconView}
        <Box flex={1} flexDirection="column">
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
              <Box flex={1}>{subTitleView}</Box>
              {!!extraView && <Box>{extraView}</Box>}
            </HStack>
          )}
        </Box>
      </HStack>
      {footer ? <Box pl="40px">{footer}</Box> : null}
    </Box>
  );
}
