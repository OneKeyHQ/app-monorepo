/**
 * Data structure for tab items
 */
export interface ITabItem<T = string> {
  /** Unique identifier for the tab */
  id: T;
  /** Display title for the tab */
  title: string;
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
}
