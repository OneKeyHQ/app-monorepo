import type { ComponentProps, ReactElement, ReactNode } from 'react';
import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useMemo,
} from 'react';

import {
  Box,
  Divider,
  HStack,
  Icon,
  Pressable,
  Text,
} from '@onekeyhq/components';
import type { PressableItemProps } from '@onekeyhq/components/src/Pressable/PressableItem';

export const DescriptionList = ({
  children,
  ...props
}: ComponentProps<typeof Box>) => {
  const validChildren = Children.toArray(children).filter((child) =>
    isValidElement(child),
  ) as ReactElement<DescriptionListItemProps>[];

  const clones = validChildren.map((child, index) => {
    // Prefer provided child key, fallback to index
    const key = child.key ?? child.props.title ?? index;
    const isLast = index + 1 === validChildren.length;
    const divider = isLast ? null : <Divider />;

    return (
      <Fragment key={key}>
        {child}
        {divider}
      </Fragment>
    );
  });

  return (
    <Box
      borderRadius="12"
      overflow="hidden"
      bg="surface-default"
      shadow="depth.2"
      {...props}
    >
      {clones}
    </Box>
  );
};

type DescriptionListItemProps = {
  title?: string;
  detail?: ReactNode;
  editable?: boolean;
  isRug?: boolean;
  detailNumberOfLines?: number;
};

export const DescriptionListItem = ({
  title,
  detail,
  detailNumberOfLines = 1,
  editable = false,
  isRug = false,
  children,
  ...pressableProps
}: PressableItemProps & DescriptionListItemProps) => {
  const detailContent = useMemo(() => {
    const key = (detail as ReactElement)?.key || 'detail';
    const textProps: ComponentProps<typeof Text> = {
      key,
      textAlign: 'right',
      typography: { sm: 'Body1Strong', md: 'Body2Strong' },
      flex: 1,
      numberOfLines: detailNumberOfLines,
    };

    if (isValidElement(detail)) {
      return cloneElement(detail, {
        // For Format component
        render: (text: string) => <Text {...textProps}>{text}</Text>,
        ...detail.props,
        key,
      });
    }
    if (typeof detail === 'string') {
      return <Text {...textProps}>{detail}</Text>;
    }
    return null;
  }, [detail, detailNumberOfLines]);

  const itemContent = useMemo(
    () =>
      isValidElement(children)
        ? children
        : // Since fragment acts like a single child, the space prop of Stack would not be working, using array instead of fragment here
          [
            !!title && (
              <Text
                key="title"
                color="text-subdued"
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              >
                {title}
              </Text>
            ),
            detailContent,
            editable && (
              <Icon
                key="edit icon"
                size={20}
                name="ChevronRightMini"
                color="icon-subdued"
              />
            ),
            // TODO: Waiting for Tooltip and add message here, id=msg__this_site_is_identified_as_a_scam
            isRug && (
              <Icon
                key="rug icon"
                size={20}
                name="ShieldExclamationMini"
                color="icon-critical"
              />
            ),
          ],
    [children, detailContent, editable, isRug, title],
  );

  const item = (
    <HStack
      w="100%"
      alignItems="center"
      justifyContent="space-between"
      space="16px"
      padding="16px"
    >
      {itemContent}
    </HStack>
  );

  if (editable) {
    return (
      <Pressable.Item
        px={0}
        py={0}
        shadow="0"
        bg="transparent"
        _pressed={{
          bg: 'surface-selected',
        }}
        {...pressableProps}
      >
        {item}
      </Pressable.Item>
    );
  }

  return item;
};
