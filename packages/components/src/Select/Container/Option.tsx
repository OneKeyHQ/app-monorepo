import React, { Fragment } from 'react';

import { Icon as NBIcon } from 'native-base';

import Box from '../../Box';
import Divider from '../../Divider';
import Icon from '../../Icon';
import { Check as CheckOUtline } from '../../Icon/react/outline';
import { Check as CheckSolid } from '../../Icon/react/solid';
import Pressable from '../../Pressable';
import { useIsVerticalLayout } from '../../Provider/hooks';
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
  asAction,
}: Pick<
  ChildProps<T>,
  'activeOption' | 'onChange' | 'renderItem' | 'asAction'
> & {
  option: SelectItem<T>;
}) {
  const isActive = option.value === activeOption.value;
  const isSmallScreen = useIsVerticalLayout();
  const OptionLabel = () =>
    isSmallScreen ? (
      <Typography.Body1
        color={option.destructive ? 'text-critical' : 'text-default'}
      >
        {option.label}
      </Typography.Body1>
    ) : (
      <Typography.Body2
        color={option.destructive ? 'text-critical' : 'text-default'}
      >
        {option.label}
      </Typography.Body2>
    );
  const SelectedIndicator = () => (
    <NBIcon
      as={isSmallScreen ? CheckOUtline : CheckSolid}
      size={{ base: '6', md: '5' }}
      color="interactive-default"
    />
  );
  return (
    renderItem?.(option, isActive, onChange) ?? (
      <Pressable
        px={{ base: '4', md: '2' }}
        py={{ base: '3', md: '2' }}
        key={option.value as unknown as string}
        onPress={() => onChange?.(option.value, option)}
        borderRadius="xl"
        display="flex"
        flexDirection="row"
        alignItems="center"
        bg={isActive && !asAction ? 'surface-selected' : undefined}
        _hover={
          // eslint-disable-next-line no-nested-ternary
          isActive && !asAction
            ? {}
            : option.destructive
            ? { bg: 'surface-critical-default' }
            : { bg: 'surface-hovered' }
        } // do not apply the hover effect on the activated item.
      >
        <Box flexDirection="row" alignItems="center" flex={1} mr={3}>
          {!!option.tokenProps && (
            <Box mr="3">
              <Token size={{ base: '8', md: '6' }} {...option.tokenProps} />
            </Box>
          )}
          {!!option.iconProps && (
            <Box mr="3">
              <Icon
                color={option.destructive ? 'icon-critical' : 'icon-default'}
                size={isSmallScreen ? 24 : 20}
                {...option.iconProps}
              />
            </Box>
          )}
          <OptionLabel />
        </Box>
        {isActive && !asAction && <SelectedIndicator />}
      </Pressable>
    )
  );
}

export function renderOptions<T>({
  options,
  activeOption,
  renderItem,
  onChange,
  asAction,
}: Pick<
  ChildProps<T>,
  'activeOption' | 'onChange' | 'renderItem' | 'options' | 'asAction'
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
              asAction,
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
      asAction,
    });
  });
}
