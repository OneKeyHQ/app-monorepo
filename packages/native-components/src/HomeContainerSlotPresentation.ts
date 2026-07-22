import {
  HOME_CONTAINER_SLOT_CONTRACT_REVISION,
  type IHomeContainerSlot,
  type IHomeContainerSlotBundle,
  type IHomeContainerSlots,
} from './HomeContainer.types';

function ownersMatch(
  left: IHomeContainerSlotBundle['owner'],
  right: IHomeContainerSlotBundle['owner'],
): boolean {
  return left.scopeKey === right.scopeKey && left.sessionId === right.sessionId;
}

function createReservedSlot(slot: IHomeContainerSlot): IHomeContainerSlot {
  return { ...slot, content: null, interaction: 'none' };
}

function hasSlotContentOrGeometry(slot: IHomeContainerSlot): boolean {
  return (
    (slot.content !== undefined && slot.content !== null) ||
    slot.height !== undefined
  );
}

function filterSlots(slots: IHomeContainerSlots): IHomeContainerSlots {
  const mapSlots = <T extends string>(
    values: Partial<Record<T, IHomeContainerSlot>> | undefined,
  ): Partial<Record<T, IHomeContainerSlot>> | undefined => {
    if (!values) {
      return undefined;
    }
    const entries = Object.entries(values);
    const filteredEntries = entries.filter(([, value]) => {
      const slot = value as IHomeContainerSlot | undefined;
      return Boolean(slot && hasSlotContentOrGeometry(slot));
    });
    return filteredEntries.length === entries.length
      ? values
      : (Object.fromEntries(filteredEntries) as Partial<
          Record<T, IHomeContainerSlot>
        >);
  };
  const accountRow =
    slots.accountRow && hasSlotContentOrGeometry(slots.accountRow)
      ? slots.accountRow
      : undefined;
  const balance =
    slots.balance && hasSlotContentOrGeometry(slots.balance)
      ? slots.balance
      : undefined;
  const headerActionRow =
    slots.headerActionRow && hasSlotContentOrGeometry(slots.headerActionRow)
      ? slots.headerActionRow
      : undefined;
  const contentHeaders = mapSlots(slots.contentHeaders);
  const contentStates = mapSlots(slots.contentStates);
  const tabAccessories = mapSlots(slots.tabAccessories);
  let contentFooters = slots.contentFooters;
  if (contentFooters) {
    const entries = Object.entries(contentFooters);
    let didChange = false;
    const nextEntries = entries.map(([tabId, footers]) => {
      const nextFooters = mapSlots(footers);
      didChange ||= nextFooters !== footers;
      return [tabId, nextFooters] as const;
    });
    if (didChange) {
      contentFooters = Object.fromEntries(nextEntries);
    }
  }
  if (
    accountRow === slots.accountRow &&
    balance === slots.balance &&
    headerActionRow === slots.headerActionRow &&
    contentHeaders === slots.contentHeaders &&
    contentStates === slots.contentStates &&
    tabAccessories === slots.tabAccessories &&
    contentFooters === slots.contentFooters
  ) {
    return slots;
  }
  return {
    ...slots,
    accountRow,
    balance,
    headerActionRow,
    contentHeaders,
    contentStates,
    tabAccessories,
    contentFooters,
  };
}

function createReservedSlots(slots: IHomeContainerSlots): IHomeContainerSlots {
  const filteredSlots = filterSlots(slots);
  const mapSlots = <T extends string>(
    values: Partial<Record<T, IHomeContainerSlot>> | undefined,
  ): Partial<Record<T, IHomeContainerSlot>> | undefined => {
    if (!values) {
      return undefined;
    }
    return Object.fromEntries(
      Object.entries(values).flatMap(([key, slot]) =>
        slot ? [[key, createReservedSlot(slot as IHomeContainerSlot)]] : [],
      ),
    ) as Partial<Record<T, IHomeContainerSlot>>;
  };
  return {
    backgroundColor: filteredSlots.backgroundColor,
    accountRow: filteredSlots.accountRow
      ? createReservedSlot(filteredSlots.accountRow)
      : undefined,
    balance: filteredSlots.balance
      ? createReservedSlot(filteredSlots.balance)
      : undefined,
    headerActionRow: filteredSlots.headerActionRow
      ? createReservedSlot(filteredSlots.headerActionRow)
      : undefined,
    contentHeaders: mapSlots(filteredSlots.contentHeaders),
    contentStates: mapSlots(filteredSlots.contentStates),
    tabAccessories: mapSlots(filteredSlots.tabAccessories),
    contentFooters: Object.fromEntries(
      Object.entries(filteredSlots.contentFooters ?? {}).map(
        ([tabId, footers]) => [tabId, mapSlots(footers)],
      ),
    ),
  };
}

function resolveHomeContainerSlots({
  acknowledgedBundle,
  currentBundle,
  legacySlots,
  preferCurrentBundle = false,
  safeFallbackBundle,
}: {
  acknowledgedBundle: IHomeContainerSlotBundle | undefined;
  currentBundle: IHomeContainerSlotBundle | undefined;
  legacySlots: IHomeContainerSlots | undefined;
  preferCurrentBundle?: boolean;
  safeFallbackBundle?: IHomeContainerSlotBundle;
}): IHomeContainerSlots | undefined {
  if (!currentBundle) {
    return legacySlots ? filterSlots(legacySlots) : undefined;
  }
  // The acknowledged bundle already carries the exact transaction revision.
  // The parent bundle may commit before or after the wrapper acknowledgement,
  // so only its current owner and slot contract participate in this gate.
  if (
    currentBundle.slotContractRevision ===
      HOME_CONTAINER_SLOT_CONTRACT_REVISION &&
    acknowledgedBundle?.slotContractRevision ===
      HOME_CONTAINER_SLOT_CONTRACT_REVISION &&
    ownersMatch(currentBundle.owner, acknowledgedBundle.owner)
  ) {
    return filterSlots(
      preferCurrentBundle ? currentBundle.slots : acknowledgedBundle.slots,
    );
  }
  if (
    currentBundle.slotContractRevision ===
      HOME_CONTAINER_SLOT_CONTRACT_REVISION &&
    safeFallbackBundle?.slotContractRevision ===
      HOME_CONTAINER_SLOT_CONTRACT_REVISION &&
    ownersMatch(currentBundle.owner, safeFallbackBundle.owner)
  ) {
    return filterSlots(
      preferCurrentBundle ? currentBundle.slots : safeFallbackBundle.slots,
    );
  }
  return createReservedSlots(currentBundle.slots);
}

export { createReservedSlots, resolveHomeContainerSlots };
