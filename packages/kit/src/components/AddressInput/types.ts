import type { EInputAddressChangeType } from '@onekeyhq/shared/types/address';

import type { IAccountSelectorActiveAccountInfo } from '../../states/jotai/contexts/accountSelector';

export type IAddressPluginProps = {
  onChange?: (text: string) => void;
  onActiveAccountChange?: (
    activeAccount: IAccountSelectorActiveAccountInfo,
  ) => void;
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
