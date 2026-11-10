import type { ReactNode } from 'react';

export type IDustSweepActionTouchProps = {
  enabled: boolean;
  disabled: boolean;
  accessibilityLabel: string;
  onPress: () => void | Promise<void>;
  children: (handlesPress: boolean, pressed: boolean) => ReactNode;
};

export function DustSweepActionTouch({ children }: IDustSweepActionTouchProps) {
  return children(false, false);
}
