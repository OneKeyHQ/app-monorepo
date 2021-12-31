import React, { Fragment, isValidElement } from 'react';

import Box from '../../Box';
import Divider from '../../Divider';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import ScrollView from '../../ScrollView';
import Typography from '../../Typography';

import { renderOptions } from './Option';

import type { ChildProps } from '..';

function Desktop<T>({
  dropdownProps,
  toggleVisible,
  options,
  onChange,
  visible,
  title,
  footer,
  footerText,
  footerIcon,
  onPressFooter,
  activeOption,
  renderItem,
  headerShown,
}: ChildProps<T>) {
  if (!visible) return null;
  return (
    <Box
      zIndex={999}
      position="absolute"
      top="48px"
      width="100%"
      maxHeight="480px"
      borderRadius="12px"
      bg="surface-subdued"
      borderColor="border-subdued"
      borderWidth="1px"
      {...dropdownProps}
    >
      {headerShown ? (
        <>
          <Box
            p="2"
            px="3"
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography.Heading>{title}</Typography.Heading>
            <Pressable onPress={toggleVisible}>
              <Icon name="CloseOutline" size={24} onPress={toggleVisible} />
            </Pressable>
          </Box>
          <Divider />
        </>
      ) : null}
      <ScrollView p="2" flex="1">
        {renderOptions<T>({ options, activeOption, renderItem, onChange })}
      </ScrollView>
      {isValidElement(footer) || footer === null ? (
        footer
      ) : (
        <>
          <Divider />
          <Pressable
            p="3"
            display="flex"
            flexDirection="row"
            justifyContent="center"
            alignItems="center"
            onPress={() => {
              toggleVisible();
              setTimeout(() => {
                onPressFooter?.();
              }, 200);
            }}
          >
            {footerIcon ? <Icon name={footerIcon} size={12} /> : null}
            <Typography.Body2 mx="2">{footerText}</Typography.Body2>
          </Pressable>
        </>
      )}
    </Box>
  );
}

export default Desktop;
