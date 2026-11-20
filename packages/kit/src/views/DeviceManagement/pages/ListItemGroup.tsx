import { Children, cloneElement, isValidElement, useMemo } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { PixelRatio } from 'react-native';

import { Divider, SizableText, XStack, YStack } from '@onekeyhq/components';
import {
  ListItem,
  ListItemDrillInPropsContext,
} from '@onekeyhq/kit/src/components/ListItem';
import {
  CARD_ROW_CHEVRON_PROPS,
  CARD_SURFACE_BG,
  CARD_SURFACE_RADIUS,
  useCardShadow,
} from '@onekeyhq/kit/src/hooks/useCardSurface';

import {
  LIST_ITEM_GROUP_INSET,
  LIST_ITEM_GROUP_ITEM_PROPS,
  LIST_ITEM_GROUP_TITLE_SIZE,
} from './listItemGroupLayout';

// One device pixel between rows: crisp on high-density screens.
const HAIRLINE = 1 / PixelRatio.get();

type IListItemGroupProps = {
  title?: string;
  children: ReactNode;
  itemProps?: Partial<ComponentProps<typeof ListItem>>;
  withSeparator?: boolean;
  groupProps?: Partial<ComponentProps<typeof YStack>>;
};

function ListItemGroupBase({
  title,
  children,
  itemProps,
  withSeparator = false,
  groupProps,
}: IListItemGroupProps) {
  const cardShadow = useCardShadow();
  const normalizedChildren = useMemo(() => {
    const arr = Children.toArray(children);
    const res: ReactNode[] = [];

    arr.forEach((child, idx) => {
      const isListItem = isValidElement(child);
      if (!isListItem) {
        res.push(child);
        return;
      }

      const mergedProps = {
        ...LIST_ITEM_GROUP_ITEM_PROPS,
        ...itemProps,
        ...(child.props as object),
      } as ComponentProps<typeof ListItem>;
      res.push(cloneElement(child, mergedProps));

      const isLast = idx === arr.length - 1;
      if (!isLast && withSeparator) {
        res.push(
          <XStack key={`sep-${idx}`} mx={LIST_ITEM_GROUP_INSET}>
            <Divider
              borderColor="$neutral4"
              borderBottomWidth={HAIRLINE}
              maxHeight={HAIRLINE}
            />
          </XStack>,
        );
      }
    });

    return res;
  }, [children, itemProps, withSeparator]);

  return (
    <YStack gap="$2.5" {...groupProps}>
      {title ? (
        <SizableText
          size={LIST_ITEM_GROUP_TITLE_SIZE}
          role="heading"
          aria-level={2}
        >
          {title}
        </SizableText>
      ) : null}
      {/* The shadow sits on an outer layer: clipping on the same view would
          cut it off on iOS. The inner layer clips row hover fills to the
          rounded corners. */}
      <YStack
        borderRadius={CARD_SURFACE_RADIUS}
        style={{ boxShadow: cardShadow }}
      >
        <YStack
          bg={CARD_SURFACE_BG}
          borderRadius={CARD_SURFACE_RADIUS}
          overflow="hidden"
        >
          <ListItemDrillInPropsContext.Provider value={CARD_ROW_CHEVRON_PROPS}>
            {normalizedChildren}
          </ListItemDrillInPropsContext.Provider>
        </YStack>
      </YStack>
    </YStack>
  );
}

function ListItemGroupItem(props: ComponentProps<typeof ListItem>) {
  return <ListItem {...LIST_ITEM_GROUP_ITEM_PROPS} {...props} />;
}

export const ListItemGroup = Object.assign(ListItemGroupBase, {
  Item: ListItemGroupItem,
});
