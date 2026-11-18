import { Children, cloneElement, isValidElement, useMemo } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { Divider, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import {
  LIST_ITEM_GROUP_INSET,
  LIST_ITEM_GROUP_ITEM_PROPS,
} from './listItemGroupLayout';

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
            <Divider borderColor="$neutral4" />
          </XStack>,
        );
      }
    });

    return res;
  }, [children, itemProps, withSeparator]);

  return (
    <YStack gap="$2.5" {...groupProps}>
      {title ? <SizableText size="$headingMd">{title}</SizableText> : null}
      <YStack
        bg="$bgApp"
        borderWidth={1}
        borderColor="$borderSubdued"
        borderRadius={12}
        overflow="hidden"
      >
        {normalizedChildren}
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
