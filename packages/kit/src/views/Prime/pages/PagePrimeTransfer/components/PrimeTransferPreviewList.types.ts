import type {
  IPrimeTransferData,
  IPrimeTransferSelectedItemMap,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

export type IPrimeTransferPreviewListProps = {
  data: IPrimeTransferData;
  selectedItemMap: IPrimeTransferSelectedItemMap;
  onItemSelectChange?: (params: {
    type: keyof IPrimeTransferSelectedItemMap;
    id: string;
    checked?: boolean;
  }) => void;
  onGroupSelectChange?: (params: {
    type: keyof IPrimeTransferSelectedItemMap;
    selectAll: boolean;
  }) => void;
};
