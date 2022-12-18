import { isNil } from 'lodash';

import { Box, Collapse, Divider, HStack, VStack } from '@onekeyhq/components';

import { TxActionElementDetailCell } from '../elements/TxActionElementDetailCell';
import { useTxDetailContext } from '../TxDetailContext';

import type { ITxActionCardViewProps } from '../types';

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

  const detailContext = useTxDetailContext();
  const isCollapse = detailContext?.context?.isCollapse;

  const titleView = !!title && (
    <>
      <HStack space={2} pb={4} alignItems="center">
        {icon}
        <VStack>
          {title}
          {subTitle}
        </VStack>
      </HStack>
      {showTitleDivider && details?.length && content ? (
        <Divider mb={4} ml={-4} mr={-4} w="auto" />
      ) : null}
    </>
  );

  const titleViewForCollapse = (
    <HStack p={2} space={2} alignItems="center">
      {icon}
      <VStack flex={1}>
        {title}
        {subTitle}
      </VStack>
    </HStack>
  );

  const contentView = (
    <>
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

  if (isCollapse) {
    return (
      <Collapse
        arrowPosition="right"
        trigger={titleViewForCollapse}
        triggerWrapperProps={{
          borderRadius: 0,
        }}
        triggerProps={{
          flex: 1,
        }}
      >
        <Divider w="auto" />
        <Box p={4}>{contentView}</Box>
      </Collapse>
    );
  }

  if (isSingleTransformMode) {
    return (
      <Box>
        {titleView}
        {contentView}
      </Box>
    );
  }
  return (
    <Box
      bg="surface-default"
      borderRadius={12}
      borderWidth={1}
      borderColor="border-subdued"
      p={4}
    >
      {titleView}
      {contentView}
    </Box>
  );
}
