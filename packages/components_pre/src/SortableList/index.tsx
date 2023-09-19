import SortableList, {
  OpacityDecorator,
  ScaleDecorator,
  ShadowDecorator,
} from 'react-native-draggable-flatlist';

import type { ISortableListType } from './index.types';

export default {
  Container: SortableList,
  ScaleDecorator,
  OpacityDecorator,
  ShadowDecorator,
} as ISortableListType;
