import { Alert } from '@onekeyhq/components';
import { usePerpsConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function PerpTips() {
  const [{ perpConfigCommon }, settingsPersistAtom] =
    usePerpsConfigPersistAtom();
  if (
    !perpConfigCommon?.perpBannerConfig ||
    perpConfigCommon?.perpBannerClosedIds?.includes(
      perpConfigCommon?.perpBannerConfig?.id,
    )
  ) {
    return null;
  }
  return (
    <Alert
      flex={1}
      type="default"
      fullBleed
      title={perpConfigCommon?.perpBannerConfig?.title}
      description={perpConfigCommon?.perpBannerConfig?.description}
      closable={!!perpConfigCommon?.perpBannerConfig?.canClose}
      onClose={() => {
        if (perpConfigCommon?.perpBannerConfig?.id) {
          void settingsPersistAtom((prev) => ({
            ...prev,
            perpConfigCommon: {
              ...prev.perpConfigCommon,
              perpBannerClosedIds: [
                perpConfigCommon?.perpBannerConfig?.id ?? '',
              ],
            },
          }));
        }
      }}
    />
  );
}
