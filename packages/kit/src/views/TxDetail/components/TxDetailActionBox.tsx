import React from 'react';

import { isNil } from 'lodash';

import { Box, HStack, VStack } from '@onekeyhq/components';

import { TxActionElementDetailCell } from '../elements/TxActionElementDetailCell';
import { ITxActionCardViewProps } from '../types';

export function TxDetailActionBox(props: ITxActionCardViewProps) {
  const { title, icon, content, details } = props;

  return (
    <Box bg="surface-default" borderRadius={12} p={4}>
      {!!title && (
        <HStack space={2} mb={4}>
          {icon}
          {title}
        </HStack>
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
    </Box>
  );
}
