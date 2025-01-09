import type { ReactElement } from 'react';

// @ts-expect-error
import NestedScrollView from 'react-native-nested-scroll-view';

import type { ScrollViewProps } from 'react-native';

const renderNestedScrollView = NestedScrollView as (
  props: ScrollViewProps,
) => ReactElement;

export { renderNestedScrollView, NestedScrollView };
