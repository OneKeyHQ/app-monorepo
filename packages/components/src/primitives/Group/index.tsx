import type { ReactNode } from 'react';
import {
  Children,
  Fragment,
  cloneElement,
  forwardRef,
  isValidElement,
} from 'react';

import {
  type GroupProps,
  Group as TMGroup,
  XGroup as TMXGroup,
  YGroup as TMYGroup,
  type TamaguiElement,
  type Token,
  getTokenValue,
  withStaticProperties,
} from '@onekeyhq/components/src/shared/tamagui';

export type IGroupProps = GroupProps & {
  separator?: ReactNode;
};

type IBaseGroup = typeof TMGroup | typeof TMXGroup | typeof TMYGroup;

// Tamagui 2 `Group.Item` only zeroes the inner corners of each item; it no
// longer passes the group's own radius to the first/last item the way
// Tamagui 1 did. An edge item with an opaque background therefore paints
// square corners over the group's rounded border. Resolve the group's radius
// (minus its border, so the item's curve sits inside the stroke) and hand it
// to the edge items; an item's explicit corner radius still wins.
function resolveEdgeRadius(props: IGroupProps): number | string | undefined {
  const raw = props.borderRadius ?? props.size ?? '$true';
  let value: unknown = raw;
  if (typeof raw === 'string' && raw.startsWith('$')) {
    value = getTokenValue(raw as Token, 'radius') ?? raw;
  }
  if (typeof value !== 'number') {
    return typeof value === 'string' ? value : undefined;
  }
  const borderWidth = props.borderWidth;
  if (typeof borderWidth === 'number' && borderWidth > 0) {
    value = Math.max(0, value - borderWidth);
  }
  return value as number;
}

function getEdgeRadiusProps({
  isFirst,
  isLast,
  vertical,
  radius,
}: {
  isFirst: boolean;
  isLast: boolean;
  vertical: boolean;
  radius: number | string;
}) {
  if (vertical) {
    return {
      ...(isFirst
        ? { borderTopLeftRadius: radius, borderTopRightRadius: radius }
        : null),
      ...(isLast
        ? { borderBottomLeftRadius: radius, borderBottomRightRadius: radius }
        : null),
    };
  }
  return {
    ...(isFirst
      ? { borderTopLeftRadius: radius, borderBottomLeftRadius: radius }
      : null),
    ...(isLast
      ? { borderTopRightRadius: radius, borderBottomRightRadius: radius }
      : null),
  };
}

function renderGroupChildren({
  children,
  separator,
  vertical,
  radius,
  Item,
}: {
  children: ReactNode;
  separator: ReactNode;
  vertical: boolean;
  radius: number | string | undefined;
  Item: IBaseGroup['Item'];
}) {
  const items = Children.toArray(children);
  const lastIndex = items.length - 1;
  const decorated =
    radius === undefined
      ? items
      : items.map((child, index) => {
          const isFirst = index === 0;
          const isLast = index === lastIndex;
          if (
            (!isFirst && !isLast) ||
            !isValidElement(child) ||
            child.type !== Item
          ) {
            return child;
          }
          return cloneElement(
            child,
            getEdgeRadiusProps({ isFirst, isLast, vertical, radius }),
          );
        });

  if (separator === undefined || separator === null) {
    return decorated;
  }

  return decorated.flatMap((child, index) =>
    index === 0
      ? [child]
      : [<Fragment key={`separator-${index}`}>{separator}</Fragment>, child],
  );
}

function createGroupWithSeparator(
  BaseGroup: IBaseGroup,
  displayName: string,
  verticalDefault: boolean,
) {
  const GroupWithSeparator = forwardRef<TamaguiElement, IGroupProps>(
    ({ children, separator, ...props }, ref) => {
      const orientation =
        props.orientation ?? (verticalDefault ? 'vertical' : 'horizontal');
      return (
        <BaseGroup ref={ref} {...props} position={props.position ?? 'relative'}>
          {renderGroupChildren({
            children,
            separator,
            vertical: orientation === 'vertical',
            radius: resolveEdgeRadius(props),
            Item: BaseGroup.Item,
          })}
        </BaseGroup>
      );
    },
  );
  GroupWithSeparator.displayName = displayName;

  return withStaticProperties(GroupWithSeparator, {
    Item: BaseGroup.Item,
  });
}

export const Group = createGroupWithSeparator(TMGroup, 'Group', true);
export const XGroup = createGroupWithSeparator(TMXGroup, 'XGroup', false);
export const YGroup = createGroupWithSeparator(TMYGroup, 'YGroup', true);
