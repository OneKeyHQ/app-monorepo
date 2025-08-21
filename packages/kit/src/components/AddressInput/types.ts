import type { EInputAddressChangeType } from '@onekeyhq/shared/types/address';

export type IAddressPluginProps = {
  onChange?: (text: string) => void;
  onInputTypeChange?: (type: EInputAddressChangeType) => void;
  onExtraDataChange?: ({
    memo,
    note,
  }: {
    memo?: string;
    note?: string;
  }) => void;
  testID?: string;
  disabled?: boolean;
};
