import {
  HomeContainerController,
  type IHomeContainerSnapshot,
} from '@onekeyhq/native-components';

export interface INativeHomeContainerControllerOwner {
  controller?: HomeContainerController;
  scopeKey?: string;
}

export function acquireNativeHomeContainerController({
  owner,
  scopeKey,
  snapshot,
}: {
  owner: INativeHomeContainerControllerOwner;
  scopeKey: string;
  snapshot: IHomeContainerSnapshot;
}): HomeContainerController {
  if (!owner.controller) {
    owner.controller = new HomeContainerController({
      initialSnapshot: snapshot,
    });
  } else if (owner.scopeKey !== scopeKey) {
    owner.controller.replaceSnapshot(snapshot);
  }
  owner.scopeKey = scopeKey;
  return owner.controller;
}
