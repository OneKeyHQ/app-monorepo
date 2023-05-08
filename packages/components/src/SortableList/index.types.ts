import type SortableList from 'react-native-draggable-flatlist';
import type {
  OpacityDecorator,
  ScaleDecorator,
  ShadowDecorator,
} from 'react-native-draggable-flatlist';

export type ISortableListType = {
  Container: typeof SortableList;
  ScaleDecorator: typeof ScaleDecorator;
  OpacityDecorator: typeof OpacityDecorator;
  ShadowDecorator: typeof ShadowDecorator;
};
