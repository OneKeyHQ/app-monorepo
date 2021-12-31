import React, { Fragment, useMemo } from 'react';

import { Icon as NBIcon } from 'native-base';

import Box from '../../Box';
import Divider from '../../Divider';
import Icon from '../../Icon';
import { Check as CheckOUtline } from '../../Icon/react/outline';
import { Check as CheckSolid } from '../../Icon/react/solid';
import Pressable from '../../Pressable';
import { useUserDevice } from '../../Provider/hooks';
import Token from '../../Token';
import Typography from '../../Typography';

import type { ChildProps, SelectGroupItem, SelectItem } from '..';

function isGroup<T>(
  item: SelectItem<T> | SelectGroupItem<T>,
): item is SelectGroupItem<T> {
  if (Array.isArray((item as SelectGroupItem<T>).options)) return true;
  return false;
}

function RenderSingleOption<T>({
  option,
  activeOption,
  onChange,
  renderItem,
}: Pick<ChildProps<T>, 'activeOption' | 'onChange' | 'renderItem'> & {
  option: SelectItem<T>;
}) {
  const isActive = option.value === activeOption.value;
  const { size } = useUserDevice();
  // TODO, optimized the responsive-relatived code in future
  const OptionLabel = useMemo(() => {
    if (['SMALL', 'NORMAL'].includes(size)) {
      return <Typography.Body1>{option.label}</Typography.Body1>;
    }

    return <Typography.Body2>{option.label}</Typography.Body2>;
  }, [size, option.label]);
  // TODO, optimized the responsive-relatived code in future
  const CheckMark = useMemo(() => {
    if (['SMALL', 'NORMAL'].includes(size)) {
      return <NBIcon as={CheckOUtline} size={6} color="interactive-default" />;
    }

    return <NBIcon as={CheckSolid} size={5} color="interactive-default" />;
  }, [size]);
  return (
    renderItem?.(option, isActive, onChange) ?? (
      <Pressable
        px={{ base: '4', lg: '2' }}
        py={{ base: '3', lg: '2' }}
        key={option.value as unknown as string}
        onPress={() => onChange?.(option.value, option)}
        borderRadius="12px"
        display="flex"
        flexDirection="row"
        alignItems="center"
        bg={isActive ? 'surface-selected' : ''}
        _hover={{ bg: 'surface-hovered' }}
      >
        <Box flexDirection="row" alignItems="center" flex={1} mr={3}>
          {!!option.tokenProps && (
            <Box mr="3">
              <Token size={{ base: '8', lg: '6' }} {...option.tokenProps} />
            </Box>
          )}
          {!!option.iconProps && (
            <Box mr="3">
              <Icon size={6} {...option.iconProps} />
            </Box>
          )}
          {OptionLabel}
        </Box>
        {!!isActive && CheckMark}
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
          <Typography.Subheading
            px={{ base: '4', lg: '2' }}
            py={{ base: '3', lg: '2' }}
            color="text-subdued"
          >
            {option.title}
          </Typography.Subheading>
          {option.options.map((subOption) =>
            RenderSingleOption<T>({
              activeOption,
              renderItem,
              onChange,
              option: subOption,
            }),
          )}
          {!isLast && (
            <Box px={{ base: '4', lg: '2' }} py={{ base: '2', lg: '1' }}>
              <Divider />
            </Box>
          )}
        </Fragment>
      );
    }

    const singleOption = option;
    return RenderSingleOption<T>({
      activeOption,
      renderItem,
      onChange,
      option: singleOption,
    });
  });
}
