import type { FC } from 'react';
import { Fragment } from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import Badge from '../../Badge';
import Box from '../../Box';
import Divider from '../../Divider';
import HStack from '../../HStack';
import Icon from '../../Icon';
import Pressable from '../../Pressable';
import Text from '../../Text';
import Token from '../../Token';
import Typography from '../../Typography';

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
  const isSmallScreen = useIsVerticalLayout();

  const optionText = (
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
            {optionText}
            {!!option.trailing && option.trailing}
            {!!isActive && !!activatable && (
              <Icon
                name={isSmallScreen ? 'CheckOutline' : 'CheckMini'}
                color="interactive-default"
                size={isSmallScreen ? 24 : 20}
              />
            )}
          </HStack>
        )}
      </Pressable>
    )
  );
}
type IRenderOptions<T = any> = Pick<
  ChildProps<T>,
  'activeOption' | 'onChange' | 'renderItem' | 'options' | 'activatable'
>;

type IRenderOptionsFC<T = any> = FC<IRenderOptions<T>>;

export const RenderOptions: IRenderOptionsFC = <T,>({
  options,
  activeOption,
  renderItem,
  onChange,
  activatable,
}: IRenderOptions<T>) => (
  <>
    {options.map((option, index) => {
      if (isGroup<T>(option)) {
        const isLast = index === options.length - 1;
        return (
          <Fragment key={`${option.title}${index}`}>
            {option.title.length > 0 ? (
              // add Pressabel fix https://onekeyhq.atlassian.net/browse/OK-16171  Sliding events do not trigger problems
              <Pressable>
                <Typography.Subheading
                  px={{ base: '4', md: '2' }}
                  pt={2}
                  color="text-subdued"
                >
                  {option.title}
                </Typography.Subheading>
              </Pressable>
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
              <Box px={{ base: '4', md: '2' }} py={1}>
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
    })}
  </>
);
