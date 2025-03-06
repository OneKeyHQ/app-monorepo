import type { PropsWithChildren } from 'react';

import { withStaticProperties } from 'tamagui';

export function StepItem() {
  return 222;
}

export type IStepperProps = PropsWithChildren;

export function BasicStepper({ children }: IStepperProps) {
  return children;
}

export const Stepper = withStaticProperties(BasicStepper, {
  Item: StepItem,
});
