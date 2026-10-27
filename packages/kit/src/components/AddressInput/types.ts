import type { EInputAddressChangeType } from '@onekeyhq/shared/types/address';

import type { IAccountSelectorActiveAccountInfo } from '../../states/jotai/contexts/accountSelector';

// Whether an address looks like another one the page lists.
export type IAddressLookalikeCheck = (address: string) => boolean;

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
  ) => void | boolean | Promise<void | boolean>;
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
