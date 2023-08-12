import type { IAccountToken } from '../../Overview/types';
import type { SharedValue } from 'react-native-reanimated';

type Field = {
  label: string;
  value: string;
};

export type CardProps = {
  item: IAccountToken;
  index: number;
  selectedCard: SharedValue<number>;
  scrollY: SharedValue<number>;
  swipeY: SharedValue<number>;
  inTransition: SharedValue<number>;
};

export type SwipeGestureProps = {
  children: React.ReactNode;
  selectedCard: SharedValue<number>;
  swipeY: SharedValue<number>;
  inTransition: SharedValue<number>;
};
