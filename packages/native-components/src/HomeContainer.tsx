import type {
  INativeHomeDiagnosticIntent,
  INativeHomeViewModel,
} from './HomeContainer.nitro';
import type { ViewProps } from 'react-native';

export interface IHomeContainerProps extends ViewProps {
  state: INativeHomeViewModel;
  onIntent: (intent: INativeHomeDiagnosticIntent) => void;
}

export function HomeContainer(_props: IHomeContainerProps) {
  return null;
}
