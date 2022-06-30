import React, { ComponentProps } from 'react';

import { Box, HStack, Text } from '@onekeyhq/components';

import { fallbackTextComponent } from '../utils/utilsTxDetail';

export type ITxListActionBoxProps = {
  icon: JSX.Element;
  title: JSX.Element | string;
  subTitle?: JSX.Element | string;
  content?: JSX.Element | string;
  extra?: JSX.Element | string;
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
  const { icon, title, content, extra, subTitle } = props;
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

  return (
    <Box>
      <HStack space={2}>
        {icon}
        <Box flex={1} flexDirection="column">
          <HStack space={2} flexDirection="row" justifyContent="space-between">
            <Box maxW={contentView ? '50%' : '100%'}>{titleView}</Box>
            {!!contentView && <Box flex={1}>{contentView}</Box>}
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
    </Box>
  );
}
