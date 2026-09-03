import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export const {
  target: bulkExportHistorySupportedNetworksPersistAtom,
  use: useBulkExportHistorySupportedNetworksPersistAtom,
} = globalAtom<string[]>({
  persist: true,
  name: EAtomNames.bulkExportHistorySupportedNetworksPersistAtom,
  initialValue: [],
});
