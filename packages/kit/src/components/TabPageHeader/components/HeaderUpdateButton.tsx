import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, useMedia } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import {
  isShowAppUpdateUIWhenUpdating,
  useAppUpdateInfo,
} from '@onekeyhq/kit/src/components/AppUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { HEADER_WIDE_MEDIA_KEY } from '../headerLayout';

// Desktop top-right "Update" button. Surfaces under the exact same conditions
// as the toolbox update dot (isShowAppUpdateUIWhenUpdating: seamless=never,
// manual/force=always, silent=only at ready) and shares the unified
// onUpdateActionDirect click logic (hot update → restart, major version →
// download/verify modal, skipping the changelog).
function BasicHeaderUpdateButton() {
  const intl = useIntl();
  const appUpdateInfo = useAppUpdateInfo(true);
  const { data, isNeedUpdate, onUpdateActionDirect } = appUpdateInfo;
  // Paired with UniversalSearchInput's width floor — see headerLayout.ts for
  // why both must flip at the same breakpoint (OK-58363).
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

  if (!showUpdate) {
    return null;
  }

  const label = intl.formatMessage({ id: ETranslations.global_update });

  if (!isWideHeader) {
    return (
      <HeaderIconButton
        testID="header-update-button"
        size="small"
        variant="accent"
        icon="RenewOutline"
        // `title` only renders a tooltip, so an icon-only button still needs
        // an explicit accessible name.
        title={label}
        accessibilityLabel={label}
        // IconButton otherwise swallows Enter/Space with a preventDefault-only
        // onKeyDown, and HeaderIconButton drops the focus ring for the quiet
        // header icons. This one is a CTA, so keep both.
        hotKey
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
        }}
        // Right gap so the button doesn't sit flush against the notification
        // bell. Self-contained (rather than parent spacing) so it disappears
        // with the button when there's no update.
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
