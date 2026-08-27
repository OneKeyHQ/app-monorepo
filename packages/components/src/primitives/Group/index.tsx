import type { ReactNode } from 'react';
import { Children, Fragment, forwardRef } from 'react';

import {
  type GroupProps,
  Group as TMGroup,
  XGroup as TMXGroup,
  YGroup as TMYGroup,
  type TamaguiElement,
  withStaticProperties,
} from '@onekeyhq/components/src/shared/tamagui';

export type IGroupProps = GroupProps & {
  separator?: ReactNode;
};

function renderChildrenWithSeparators(
  children: ReactNode,
  separator: ReactNode,
) {
  if (separator === undefined || separator === null) {
    return children;
  }

  return Children.toArray(children).flatMap((child, index) =>
    index === 0
      ? [child]
      : [<Fragment key={`separator-${index}`}>{separator}</Fragment>, child],
  );
}

function createGroupWithSeparator(
  BaseGroup: typeof TMGroup | typeof TMXGroup | typeof TMYGroup,
  displayName: string,
) {
  const GroupWithSeparator = forwardRef<TamaguiElement, IGroupProps>(
    ({ children, separator, ...props }, ref) => (
      <BaseGroup ref={ref} {...props}>
        {renderChildrenWithSeparators(children, separator)}
      </BaseGroup>
    ),
  );
  GroupWithSeparator.displayName = displayName;

  return withStaticProperties(GroupWithSeparator, {
    Item: BaseGroup.Item,
  });
}

export const Group = createGroupWithSeparator(TMGroup, 'Group');
export const XGroup = createGroupWithSeparator(TMXGroup, 'XGroup');
export const YGroup = createGroupWithSeparator(TMYGroup, 'YGroup');
