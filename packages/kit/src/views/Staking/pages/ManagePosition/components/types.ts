import type { ReactElement } from 'react';

import type { IButtonProps } from '@onekeyhq/components';

// Button configuration for special manage layout
export interface ISpecialManageButton {
  text: string;
  variant?: IButtonProps['variant'];
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void | Promise<void>;
}

// Button layout types
export enum ESpecialManageLayoutType {
  Single = 'single', // Single primary button
  Dual = 'dual', // Two buttons side by side
}

// Complete button configuration
export interface ISpecialManageButtonConfig {
  type: ESpecialManageLayoutType;
  buttons: {
    primary?: ISpecialManageButton;
    secondary?: ISpecialManageButton;
  };
  footer?: ReactElement; // Custom footer for modal context
}
