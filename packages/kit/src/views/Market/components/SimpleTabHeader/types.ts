import type { ComponentProps } from 'react';

import type { XStack } from '@onekeyhq/components';

/**
 * Data structure for tab items
 */
export interface ITabItem<T = string> {
  /** Unique identifier for the tab */
  id: T;
  /** Display title for the tab */
  title: string;
  /** Optional disabled state */
  disabled?: boolean;
}

/**
 * Props interface for SimpleTabHeader component
 */
export interface ISimpleTabHeaderProps<T = string> {
  /** Array of tab data */
  data: ITabItem<T>[];
  /** Currently active tab index */
  activeIndex: number;
  /** Callback when tab is pressed */
  onTabPress: (index: number, tabId: T) => void;
  /** Optional custom title renderer */
  renderTitle?: (
    item: ITabItem<T>,
    index: number,
    isActive: boolean,
  ) => React.ReactNode;
  /** Optional container styling props */
  containerProps?: ComponentProps<typeof XStack>;
  /** Optional button size */
  size?: 'small' | 'medium' | 'large';
  /** Optional gap between buttons */
  gap?: string;
}
