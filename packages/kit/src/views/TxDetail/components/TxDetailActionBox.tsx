import React from 'react';

import { isNil } from 'lodash';

import { Box, Divider, HStack, VStack } from '@onekeyhq/components';

import { TxActionElementDetailCell } from '../elements/TxActionElementDetailCell';
import { ITxActionCardViewProps } from '../types';

export function TxDetailActionBox(props: ITxActionCardViewProps) {
  const {
    title,
    subTitle,
    icon,
    content,
    details,
    showTitleDivider,
    isSingleTransformMode,
  } = props;

  const iconView = icon;
  const titleView = title;

  const contentView = (
    <>
      {!!titleView && (
        <>
          <HStack space={2} pb={4} alignItems="center">
            {iconView}
            <VStack>
              {titleView}
              {subTitle}
            </VStack>
          </HStack>
          {showTitleDivider && details?.length && content ? (
            <Divider mb={4} ml={-4} mr={-4} w="auto" />
          ) : null}
        </>
      )}
      {content}
      <VStack space={4}>
        {(details ?? [])
          .filter(Boolean)
          .map((detail, index) =>
            !isNil(detail) ? (
              <TxActionElementDetailCell key={index} {...detail} />
            ) : null,
          )}
      </VStack>
    </>
  );

  if (isSingleTransformMode) {
    return <Box>{contentView}</Box>;
  }
  return (
    <Box bg="surface-default" borderRadius={12} p={4}>
      {contentView}
    </Box>
  );
}
