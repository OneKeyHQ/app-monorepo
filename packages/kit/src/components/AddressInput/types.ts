import type { EInputAddressChangeType } from '@onekeyhq/shared/types/address';

import type { IAccountSelectorActiveAccountInfo } from '../../states/jotai/contexts/accountSelector';

export type IAddressPluginProps = {
  onChange?: ({
    text,
    inputType,
  }: {
    text: string;
    inputType: EInputAddressChangeType;
  }) => void;
  onActiveAccountChange?: (
    activeAccount: IAccountSelectorActiveAccountInfo,
  ) => void;
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
