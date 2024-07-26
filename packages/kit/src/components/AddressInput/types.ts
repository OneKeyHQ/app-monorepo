import type { EInputAddressChangeType } from '@onekeyhq/shared/types/address';

export type IAddressPluginProps = {
  onChange?: (text: string) => void;
  onInputTypeChange?: (type: EInputAddressChangeType) => void;
  testID?: string;
};
