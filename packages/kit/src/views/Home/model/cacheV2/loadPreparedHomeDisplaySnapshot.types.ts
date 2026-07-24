import type {
  IHomeNavigationSemanticModel,
  IHomeShellSemanticModel,
} from '../semantic/homeSemanticTypes';
import type { IHomeCachedSourceRecord } from '../store/homeStoreTypes';

export type IPreparedHomeDisplaySnapshot = {
  navigation?: IHomeNavigationSemanticModel;
  records: readonly IHomeCachedSourceRecord[];
  shell?: IHomeShellSemanticModel;
};
