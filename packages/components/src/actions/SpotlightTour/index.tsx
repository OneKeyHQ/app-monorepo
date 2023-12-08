import { AttachStep, SpotlightTourProvider } from 'react-native-spotlight-tour';

import type {
  SpotlightTourProviderProps,
  TourStep as TourStepType,
} from 'react-native-spotlight-tour';

export type ISpotlightTourProviderProps = SpotlightTourProviderProps;
export function SpotlightTour({
  children,
  ...props
}: SpotlightTourProviderProps) {
  return <SpotlightTourProvider {...props}>{children}</SpotlightTourProvider>;
}

export type ITourStep = TourStepType;

export {
  // middleware
  flip,
  offset,
  shift,
  arrow,
  autoPlacement,
  hide,
  inline,
  // hooks
  useSpotlightTour,
} from 'react-native-spotlight-tour';

export const TourStep = AttachStep;
