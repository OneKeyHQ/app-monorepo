import type { ILoadedHomeDisplaySnapshotManifest } from './homeDisplaySnapshotTypes';
import type {
  IHomeNavigationSemanticModel,
  IHomeShellSemanticModel,
} from '../semantic/homeSemanticTypes';
import type { IHomeCachedSourceRecord } from '../store/homeStoreTypes';

export type IPreparedHomeDisplaySnapshot = {
  context: ILoadedHomeDisplaySnapshotManifest;
  navigation?: IHomeNavigationSemanticModel;
  records: readonly IHomeCachedSourceRecord[];
  shell?: IHomeShellSemanticModel;
};
