import { Suspense, lazy, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, useMedia } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import {
  isShowAppUpdateUIWhenUpdating,
  useAppUpdateInfo,
} from '@onekeyhq/kit/src/components/AppUpdate';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import {
  EAppUpdateStatus,
  EUpdateFileType,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HEADER_WIDE_MEDIA_KEY } from '../headerLayout';

// The capsule is desktop-only. Loading it lazily keeps it out of the web and
// native startup graph; platformEnv is build-time folded, so those bundles drop
// the dynamic import entirely.
const LazyUpdateCapsule = platformEnv.isDesktop
  ? lazy(async () => {
      const { UpdateCapsule } = await import('./UpdateCapsule');
      return { default: UpdateCapsule };
    })
  : null;

function BasicHeaderUpdateButton() {
  const intl = useIntl();
  const [{ enableAutoDownloadAppUpdate }] = useSettingsPersistAtom();
  const {
    data,
    isNeedUpdate,
    updateFileType,
    onUpdateActionDirect,
    onViewReleaseInfo,
  } = useAppUpdateInfo(true);
  const isWideHeader = useMedia()[HEADER_WIDE_MEDIA_KEY];
  const showUpdate = useMemo(
    () =>
      isNeedUpdate &&
      isShowAppUpdateUIWhenUpdating({
        updateStrategy: data.updateStrategy,
        updateStatus: data.status,
      }),
    [isNeedUpdate, data.updateStrategy, data.status],
  );
  const isFullPackage =
    updateFileType === EUpdateFileType.appShell &&
    data.updateStrategy !== EUpdateStrategy.force &&
    data.status !== EAppUpdateStatus.manualInstall &&
    !data.storeUrl &&
    data.downloadUrl?.startsWith('https://');

  // Keep the banner mounted after the atom is cleared so first-launch success
  // remains visible for its six-second window.
  if (isFullPackage || data.status === EAppUpdateStatus.done) {
    if (!LazyUpdateCapsule) return null;
    return (
      <Suspense fallback={null}>
        <LazyUpdateCapsule
          data={data}
          showUpdate={
            Boolean(isFullPackage) &&
            isNeedUpdate &&
            data.updateStrategy !== EUpdateStrategy.seamless &&
            (data.status !== EAppUpdateStatus.notify ||
              data.updateStrategy === EUpdateStrategy.manual ||
              enableAutoDownloadAppUpdate === false)
          }
          onWhatsNew={onViewReleaseInfo}
        />
      </Suspense>
    );
  }
  if (!showUpdate) return null;

  const label = intl.formatMessage({ id: ETranslations.global_update });
  if (!isWideHeader) {
    return (
      <HeaderIconButton
        testID="header-update-button"
        size="small"
        variant="accent"
        icon={data.storeUrl ? 'StoreOutline' : 'ArrowTopCircleOutline'}
        title={label}
        accessibilityLabel={label}
        hotKey
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
        }}
        mr="$3"
        onPress={onUpdateActionDirect}
      />
    );
  }
  return (
    <Button
      testID="header-update-button"
      size="small"
      variant="accent"
      icon={data.storeUrl ? 'StoreOutline' : undefined}
      mr="$3"
      onPress={onUpdateActionDirect}
    >
      {label}
    </Button>
  );
}

export const HeaderUpdateButton = platformEnv.isDesktop
  ? BasicHeaderUpdateButton
  : () => null;
