type ITravelModePersistViewParams = {
  initialValue: unknown;
  persistedValue: unknown;
};

type ITravelModePersistWriteParams = {
  persistedValue: unknown;
  proposedValue: unknown;
};

function buildPersistedView({
  initialValue,
  persistedValue,
}: ITravelModePersistViewParams): unknown {
  return persistedValue ?? initialValue;
}

function mergePersistedWrite({
  persistedValue,
  proposedValue,
}: ITravelModePersistWriteParams): unknown {
  return proposedValue ?? persistedValue;
}

export const buildTravelModePasswordPersistView = buildPersistedView;
export const buildTravelModeManualLockPersistView = buildPersistedView;
export const buildTravelModeSettingsPersistView = buildPersistedView;
export const buildTravelModeCurrencyReferenceView = buildPersistedView;

export const mergeTravelModePasswordPersistWrite = mergePersistedWrite;
export const mergeTravelModeSettingsPersistWrite = mergePersistedWrite;
