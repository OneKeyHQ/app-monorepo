import type { ComponentProps } from 'react';

import type { XStack } from '@onekeyhq/components';

export interface IAddressDisplayProps {
  address: string;
  // Feature toggles
  enableCopy?: boolean;
  enableOpenInBrowser?: boolean;
  // Display options
  addressFormatOptions?: {
    leadingLength?: number;
    trailingLength?: number;
  };
  // Custom handlers
  onCopyAddress?: () => void;
  onOpenInBrowser?: () => void;
  // Style customization
  style?: ComponentProps<typeof XStack>;
  // Optional network info for browser opening
  networkId?: string;
  txId?: string;
}
