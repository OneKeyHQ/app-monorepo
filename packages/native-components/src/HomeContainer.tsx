import type {
  INativeHomeIntent,
  INativeHomeViewModel,
} from './HomeContainer.nitro';
import type { ViewProps } from 'react-native';

export interface IHomeContainerProps extends ViewProps {
  state: INativeHomeViewModel;
  onIntent: (intent: INativeHomeIntent) => void;
}

export function HomeContainer(_props: IHomeContainerProps) {
  return null;
}
