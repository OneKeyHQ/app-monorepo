import { useCallback } from 'react';

import { isNil } from 'lodash';
import { MotiView } from 'moti';

import {
  Box,
  Collapse,
  Divider,
  HStack,
  Icon,
  Pressable,
  VStack,
} from '@onekeyhq/components';

import { TxActionElementDetailCell } from '../elements/TxActionElementDetailCell';
import { useTxDetailContext } from '../TxDetailContext';

import type { ITxActionCardViewProps, ITxActionElementDetail } from '../types';

export function TxDetailActionBox(props: ITxActionCardViewProps) {
  const {
    title,
    subTitle,
    desc,
    icon,
    content,
    details,
    showTitleDivider,
    showContentDivider,
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

  const titleViewForCollapse = useCallback(
    (collapsed?: boolean) =>
      title ? (
        <HStack p={2} space={2} alignItems="center" flex={1}>
          {icon}
          <VStack flex={1}>
            <HStack alignItems="baseline" space={2}>
              {title}
              {collapsed ? desc : null}
            </HStack>
            {subTitle}
          </VStack>
        </HStack>
      ) : null,
    [desc, icon, subTitle, title],
  );

  const getDetailElement = useCallback(
    (
      index: number,
      detail: ITxActionElementDetail | JSX.Element | undefined | null,
    ) => {
      if (isNil(detail)) return null;

      if ((detail as ITxActionElementDetail)?.title) {
        return (
          <>
            <TxActionElementDetailCell
              key={index}
              {...(detail as ITxActionElementDetail)}
            />
            {showContentDivider && index !== (details?.length ?? 0) - 1 && (
              <Divider />
            )}
          </>
        );
      }

      return (
        <>
          {detail}
          {showContentDivider && index !== (details?.length ?? 0) - 1 && (
            <Divider />
          )}
        </>
      );
    },
    [details?.length, showContentDivider],
  );

  const contentView = (
    <>
      {content}
      <VStack space={4}>
        {(details ?? [])
          .filter(Boolean)
          .map((detail, index) => getDetailElement(index, detail))}
      </VStack>
    </>
  );

  if (isCollapse && title) {
    return (
      <Collapse
        arrowPosition="right"
        renderCustomTrigger={(onPress, collapsed) => (
          <Pressable
            onPress={onPress}
            p="8px"
            _hover={{ bgColor: 'surface-hovered' }}
            _pressed={{ bgColor: 'surface-pressed' }}
          >
            <HStack alignItems="center" justifyContent="space-between">
              {titleViewForCollapse(collapsed)}
              <MotiView animate={{ rotate: collapsed ? '0deg' : '90deg' }}>
                <Icon name="ChevronRightMini" size={20} color="icon-subdued" />
              </MotiView>
            </HStack>
          </Pressable>
        )}
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
