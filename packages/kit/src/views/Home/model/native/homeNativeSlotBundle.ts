import {
  HOME_CONTAINER_SLOT_CONTRACT_REVISION,
  type IHomeContainerOwner,
  type IHomeContainerSlotBundle,
  type IHomeContainerSlots,
} from '@onekeyhq/native-components';

function createHomeNativeSlotBundle({
  owner,
  semanticRevision,
  slotContractRevision,
  slots,
}: {
  owner: IHomeContainerOwner;
  semanticRevision: number;
  slotContractRevision: number;
  slots: IHomeContainerSlots;
}): IHomeContainerSlotBundle {
  return { owner, semanticRevision, slotContractRevision, slots };
}

function isHomeNativeSlotBundleCurrent({
  bundle,
  owner,
  renderedRevision,
}: {
  bundle: IHomeContainerSlotBundle;
  owner: IHomeContainerOwner;
  renderedRevision: number;
}): boolean {
  return (
    bundle.owner.scopeKey === owner.scopeKey &&
    bundle.owner.sessionId === owner.sessionId &&
    bundle.semanticRevision === renderedRevision &&
    bundle.slotContractRevision === HOME_CONTAINER_SLOT_CONTRACT_REVISION
  );
}

export { createHomeNativeSlotBundle, isHomeNativeSlotBundleCurrent };
