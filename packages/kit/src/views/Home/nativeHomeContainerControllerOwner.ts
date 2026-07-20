import {
  HomeContainerController,
  type IHomeContainerOwner,
  type IHomeContainerSnapshot,
} from '@onekeyhq/native-components';

import { createHomeAuthorityId } from './model/core/homeIdentity';

export interface INativeHomeContainerControllerOwner {
  controller?: HomeContainerController;
  scopeKey?: string;
  nativeOwner?: IHomeContainerOwner;
}

export function acquireNativeHomeContainerController({
  owner,
  scopeKey,
  snapshot,
  deferScopeCommit = false,
}: {
  owner: INativeHomeContainerControllerOwner;
  scopeKey: string;
  snapshot: IHomeContainerSnapshot;
  deferScopeCommit?: boolean;
}): HomeContainerController {
  if (!owner.controller) {
    owner.nativeOwner = {
      scopeKey,
      sessionId: createHomeAuthorityId('session'),
    };
    owner.controller = new HomeContainerController({
      initialSnapshot: snapshot,
      initialOwner: owner.nativeOwner,
    });
    owner.scopeKey = scopeKey;
  } else if (!deferScopeCommit && owner.scopeKey !== scopeKey) {
    commitNativeHomeContainerControllerScope({ owner, scopeKey, snapshot });
  }
  return owner.controller;
}

export function commitNativeHomeContainerControllerScope({
  owner,
  scopeKey,
  snapshot,
}: {
  owner: INativeHomeContainerControllerOwner;
  scopeKey: string;
  snapshot: IHomeContainerSnapshot;
}): boolean {
  const controller = owner.controller;
  if (!controller || owner.scopeKey === scopeKey) {
    return false;
  }
  if (
    owner.scopeKey === undefined &&
    controller.getOwner().scopeKey === scopeKey
  ) {
    owner.scopeKey = scopeKey;
    owner.nativeOwner = controller.getOwner();
    return true;
  }
  owner.nativeOwner = {
    scopeKey,
    sessionId: createHomeAuthorityId('session'),
  };
  controller.replaceOwner(owner.nativeOwner, snapshot);
  owner.scopeKey = scopeKey;
  return true;
}
