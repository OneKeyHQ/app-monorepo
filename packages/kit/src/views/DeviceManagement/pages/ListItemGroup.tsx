import { Children, cloneElement, isValidElement, useMemo } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import {
  Divider,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { TabSettingsSection } from '../../Setting/pages/Tab/ListItem';

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
  const { gtMd } = useMedia();
  const py = gtMd ? undefined : '$3';

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
        mx: '$0',
        px: '$5',
        py,
        borderRadius: '$0',
        ...itemProps,
        ...(child.props as object),
      } as ComponentProps<typeof ListItem>;
      res.push(cloneElement(child, mergedProps));

      const isLast = idx === arr.length - 1;
      if (!isLast && withSeparator) {
        res.push(
          <XStack key={`sep-${idx}`} mx="$5">
            <Divider borderColor="$neutral4" />
          </XStack>,
        );
      }
    });

    return res;
  }, [children, itemProps, withSeparator, py]);

  return (
    <YStack>
      {title ? (
        <XStack ai="center" h="$10" px="$5">
          <SizableText size="$headingXs" color="$textSubdued">
            {title}
          </SizableText>
        </XStack>
      ) : null}

      <TabSettingsSection
        borderRadius="$4"
        bg="$bgApp"
        borderWidth={1}
        borderColor="$neutral4"
        {...groupProps}
      >
        {normalizedChildren}
      </TabSettingsSection>
    </YStack>
  );
}

function ListItemGroupItem(props: ComponentProps<typeof ListItem>) {
  return <ListItem mx="$0" px="$5" borderRadius="$0" {...props} />;
}

export const ListItemGroup = Object.assign(ListItemGroupBase, {
  Item: ListItemGroupItem,
});
