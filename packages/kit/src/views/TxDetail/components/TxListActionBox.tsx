import React, { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Box, HStack, Text } from '@onekeyhq/components';
import {
  IDecodedTx,
  IDecodedTxStatus,
  IHistoryTx,
} from '@onekeyhq/engine/src/vaults/types';

import { fallbackTextComponent, getTxStatusInfo } from '../utils/utilsTxDetail';

export type ITxListActionBoxProps = {
  icon: JSX.Element;
  title: JSX.Element | string;
  subTitle?: JSX.Element | string;
  content?: JSX.Element | string;
  extra?: JSX.Element | string;
  footer?: JSX.Element | string;
  decodedTx: IDecodedTx;
  historyTx: IHistoryTx | undefined;
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
  const {
    icon,
    title,
    content,
    extra,
    subTitle,
    footer,
    decodedTx,
    historyTx,
  } = props;
  const titleView = fallbackTextComponent(title, TxListActionBoxTitleText);
  const contentView = fallbackTextComponent(
    content,
    TxListActionBoxContentText,
  );
  const subTitleView = fallbackTextComponent(
    subTitle,
    TxListActionBoxSubTitleText,
  );
  const extraView = fallbackTextComponent(extra, TxListActionBoxExtraText);
  const intl = useIntl();
  const statusInfo = getTxStatusInfo({ decodedTx });

  let replacedTextView = null;
  if (historyTx?.replacedType === 'cancel') {
    replacedTextView = (
      <Text typography="Body2" color="text-subdued">
        取消后的交易
      </Text>
    );
  }
  if (historyTx?.replacedType === 'speedUp') {
    replacedTextView = (
      <Text typography="Body2" color="text-subdued">
        加速后的交易
      </Text>
    );
  }

  const txStatusTextView =
    decodedTx.status !== IDecodedTxStatus.Confirmed ? (
      <Text typography="Body2" color={statusInfo.textColor}>
        {intl.formatMessage({ id: statusInfo.text })}
      </Text>
    ) : undefined;

  const statusBarView =
    txStatusTextView || replacedTextView ? (
      <HStack pl="40px" space={2}>
        {txStatusTextView}
        {replacedTextView}
      </HStack>
    ) : undefined;

  return (
    <Box>
      <HStack space={2}>
        {icon}
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
      {statusBarView}
      {footer ? <Box pl="40px">{footer}</Box> : null}
    </Box>
  );
}
