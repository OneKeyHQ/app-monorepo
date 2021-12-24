import React, { Fragment } from 'react';

import Box from '../../Box';
import Divider from '../../Divider';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import Token from '../../Token';
import Typography from '../../Typography';

import type { ChildProps, SelectGroupItem, SelectItem } from '..';

function isGroup<T>(
  item: SelectItem<T> | SelectGroupItem<T>,
): item is SelectGroupItem<T> {
  if (Array.isArray((item as SelectGroupItem<T>).options)) return true;
  return false;
}

function renderSingleOption<T>({
  option,
  activeOption,
  onChange,
  renderItem,
}: Pick<ChildProps<T>, 'activeOption' | 'onChange' | 'renderItem'> & {
  option: SelectItem<T>;
}) {
  const isActive = option.value === activeOption.value;
  return (
    renderItem?.(option, isActive, onChange) ?? (
      <Pressable
        p="3"
        py="2"
        key={option.value as unknown as string}
        onPress={() => onChange?.(option.value, option)}
        borderRadius="12px"
        display="flex"
        flexDirection="row"
        alignItems="center"
        bg={isActive ? 'surface-selected' : 'transparent'}
      >
        {!!option.tokenProps && (
          <Box mr="2">
            <Token size={6} {...option.tokenProps} />
          </Box>
        )}
        {!!option.iconProps && (
          <Box mr="2">
            <Icon size={6} {...option.iconProps} />
          </Box>
        )}
        <Typography.Body1>{option.label}</Typography.Body1>
      </Pressable>
    )
  );
}

export function renderOptions<T>({
  options,
  activeOption,
  renderItem,
  onChange,
}: Pick<
  ChildProps<T>,
  'activeOption' | 'onChange' | 'renderItem' | 'options'
>) {
  return options.map((option, index) => {
    if (isGroup<T>(option)) {
      const isLast = index === options.length - 1;
      return (
        <Fragment key={option.title}>
          <Typography.Subheading pt="3" pb="1" px="3" color="text-subdued">
            {option.title}
          </Typography.Subheading>
          {option.options.map((subOption) =>
            renderSingleOption<T>({
              activeOption,
              renderItem,
              onChange,
              option: subOption,
            }),
          )}
          {!isLast && <Divider my="1" />}
        </Fragment>
      );
    }

    const singleOption = option;
    return renderSingleOption<T>({
      activeOption,
      renderItem,
      onChange,
      option: singleOption,
    });
  });
}
