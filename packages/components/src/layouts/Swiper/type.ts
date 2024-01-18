import type { FlatListProps, ViewabilityConfig } from 'react-native';

type IScrollToIndex = { index: number; animated?: boolean }; // DUPLICATED
export type ISwiperFlatListRefProps = {
  getCurrentIndex: () => number;
  getPrevIndex: () => number;
  scrollToIndex: (item: IScrollToIndex) => void;
  goToLastIndex: () => void;
  goToFirstIndex: () => void;
};

export type ISwiperFlatListProps<T> = Partial<FlatListProps<T>> & {

  children?: React.ReactNode | React.ReactNode[];

  data?: T[];


  /**
   * Index to start
   * Defaults to '0'
   *
   */
  index?: number;

  /**
   * Render all the items before display it
   * Defaults to 'false'
   *
   */
  renderAll?: boolean;

  /**
   * Takes an item from data and renders it into the list
   * not required if children is used
   *
   */
  renderItem?: FlatListProps<T>['renderItem'];

  /**
   * Executed every time the index change, the index change when the user reaches 60% of the next screen
   *
   */
  onChangeIndex?: (item: { index: number; prevIndex: number }) => void;

  /**
   * Disable swipe gesture
   * Defaults to 'false'
   *
   */
  disableGesture?: boolean;

  /**
   * TestID for automation testing
   *
   */
  e2eID?: string;

  // #region Autoplay

  /**
   * Delay between every page in seconds
   * Defaults to '3'
   *
   */
  autoplayDelay?: number;

  /**
   * Change index automatically
   * Defaults to 'false'
   *
   */
  autoplay?: boolean;

  /**
   * Invert auto play direction
   * Defaults to 'false'
   *
   */
  autoplayInvertDirection?: boolean;

  /**
   * Continue playing after reach end
   * Defaults to 'false'
   *
   */
  autoplayLoop?: boolean;

  /**
   * Show animation when reach the end of the list
   * Defaults to 'false'
   *
   */
  autoplayLoopKeepAnimation?: boolean;

  // #endregion

  // #region RN props
  /**
   * Called after scroll end and the first parameter is the current index
   *
   */
  onMomentumScrollEnd?: (item: { index: number }, event: any) => void;
  // onMomentumScrollEnd: ScrollViewProps['onMomentumScrollEnd'];

  /**
   * See https://github.com/facebook/react-native/blob/master/Libraries/Lists/VirtualizedList.js#L240 for further documentation.
   *
   */
  onViewableItemsChanged?: FlatListProps<T>['onViewableItemsChanged'];

  /**
   * See https://github.com/facebook/react-native/blob/master/Libraries/Lists/VirtualizedList.js#L280 for further documentation.
   */
  viewabilityConfig?: ViewabilityConfig;

  // #endregion

  // #region Pagination

  /**
   * Show pagination
   * Defaults to 'false'
   *
   */
  showPagination?: boolean;

  /**
   * Use react-native-gesture-handler FlatList instead of the native FlatList
   *
   * Defaults to 'false'
   */
  useReactNativeGestureHandler?: boolean;
};
