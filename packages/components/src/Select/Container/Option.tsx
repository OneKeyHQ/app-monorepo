import { Fragment } from 'react';

import { Icon as NBIcon } from 'native-base';

import Badge from '../../Badge';
import Box from '../../Box';
import Divider from '../../Divider';
import HStack from '../../HStack';
import Icon from '../../Icon';
import { Check as CheckOUtline } from '../../Icon/react/outline';
import { Check as CheckSolid } from '../../Icon/react/solid';
import Pressable from '../../Pressable';
import { useIsVerticalLayout } from '../../Provider/hooks';
import Token from '../../Token';
import Typography, { Text } from '../../Typography';

import type { ChildProps, SelectGroupItem, SelectItem } from '..';

function isGroup<T>(
  item: SelectItem<T> | SelectGroupItem<T>,
): item is SelectGroupItem<T> {
  if (Array.isArray((item as SelectGroupItem<T>).options)) return true;
  return false;
}

function Leading<T>({ option }: { option: SelectItem<T> }) {
  const isSmallScreen = useIsVerticalLayout();
  // hooks only available in React component
  return (
    <>
      {!!option.leading && option.leading}
      {!!option.tokenProps && (
        <Token size={{ base: '8', md: '6' }} {...option.tokenProps} />
      )}
      {!!option.iconProps && (
        <Icon
          color={option.destructive ? 'icon-critical' : 'icon-default'}
          size={isSmallScreen ? 24 : 20}
          {...option.iconProps}
        />
      )}
    </>
  );
}

function RenderSingleOption<T>({
  option,
  activeOption,
  onChange,
  renderItem,
  activatable,
}: Pick<
  ChildProps<T>,
  'activeOption' | 'onChange' | 'renderItem' | 'activatable'
> & {
  option: SelectItem<T>;
}) {
  const isActive = option.value === activeOption.value;

  const OptionText = () => (
    <Box flex={1}>
      <HStack alignItems="center">
        <Text
          color={
            option.destructive
              ? 'text-critical'
              : option.color ?? 'text-default'
          }
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          isTruncated
          mr={2}
        >
          {option.label}
        </Text>
        {!!option.badge && (
          <Badge title={option.badge} size="sm" type="default" />
        )}
      </HStack>
      {!!option.description && (
        <Typography.Body2 color="text-subdued">
          {option.description ?? '-'}
        </Typography.Body2>
      )}
    </Box>
  );
  const SelectedIndicator = () => {
    // hooks only available in React component
    const isSmallScreen = useIsVerticalLayout();
    return (
      <NBIcon
        as={isSmallScreen ? CheckOUtline : CheckSolid}
        size={{ base: '6', md: '5' }}
        color="interactive-default"
      />
    );
  };
  return (
    renderItem?.(option, isActive, onChange) ?? (
      <Pressable
        key={option.value as unknown as string}
        onPress={() => {
          onChange?.(option.value, option);
        }}
      >
        {({ isHovered, isPressed }) => (
          <HStack
            alignItems="center"
            space={3}
            px={{ base: '4', md: '2' }}
            py={{ base: '3', md: '2' }}
            borderRadius="xl"
            bg={
              // eslint-disable-next-line no-nested-ternary
              isPressed
                ? 'surface-pressed'
                : // eslint-disable-next-line no-nested-ternary
                isHovered
                ? option.destructive
                  ? 'surface-critical-default'
                  : 'surface-hovered'
                : undefined
            }
          >
            {(!!option.tokenProps ||
              !!option.iconProps ||
              !!option.leading) && <Leading option={option} />}
            <OptionText />
            {!!option.trailing && option.trailing}
            {!!isActive && !!activatable && <SelectedIndicator />}
          </HStack>
        )}
      </Pressable>
    )
  );
}

export function renderOptions<T>({
  options,
  activeOption,
  renderItem,
  onChange,
  activatable,
}: Pick<
  ChildProps<T>,
  'activeOption' | 'onChange' | 'renderItem' | 'options' | 'activatable'
>) {
  return options.map((option, index) => {
    if (isGroup<T>(option)) {
      const isLast = index === options.length - 1;
      return (
        <Fragment key={`${option.title}${index}`}>
          {option.title.length > 0 ? (
            <Typography.Subheading
              px={{ base: '4', lg: '2' }}
              py={{ base: '3', lg: '2' }}
              color="text-subdued"
            >
              {option.title}
            </Typography.Subheading>
          ) : null}
          {option.options.map((subOption) =>
            RenderSingleOption<T>({
              activeOption,
              renderItem,
              onChange,
              option: subOption,
              activatable,
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
      activatable,
    });
  });
}
