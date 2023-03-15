import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Spinner,
  Switch,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAutoUpdate, useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { setUpdateSetting } from '@onekeyhq/kit/src/store/reducers/settings';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { DesktopVersion } from '../../../utils/updates/type';

const AutoUpdateSectionItem: FC = () => {
  const intl = useIntl();

  const { dispatch } = backgroundApiProxy;
  const { state, progress, latest } = useAutoUpdate();
  const { autoDownload = true } = useSettings().updateSetting ?? {};
  const [showAvailabelBadge, setShowAvailableBadge] = useState(true);

  const onCheckUpdate = useCallback(() => {
    appUpdates
      .checkUpdate(true)
      ?.then((version) => {
        if (!version) {
          ToastManager.show({
            title: intl.formatMessage({
              id: 'msg__using_latest_release',
            }),
          });
        }
      })
      .catch(() => {})
      .finally(() => {});
  }, [intl]);

  useEffect(() => {
    if (
      platformEnv.isDesktop &&
      platformEnv.supportAutoUpdate &&
      state === 'available'
    ) {
      const { version = '0.0.0' } = (latest ?? {}) as DesktopVersion;
      if (appUpdates.skipVersionCheck(version)) {
        setShowAvailableBadge(false);
      }
    }
  }, [state, latest]);

  const onDownloadUpdate = useCallback(
    () => window.desktopApi?.downloadUpdate?.(),
    [],
  );

  const onInstallUpdate = useCallback(
    () => window.desktopApi?.installUpdate?.(),
    [],
  );

  const Content = useMemo(() => {
    if (platformEnv.isWeb || platformEnv.isExtension) {
      return null;
    }

    if (state === 'not-available' || state === 'checking') {
      return (
        <Pressable
          display="flex"
          flexDirection="row"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={onCheckUpdate}
        >
          <Icon name="RocketLaunchOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'form__check_for_updates',
            })}
          </Text>
          {state === 'checking' ? (
            <Spinner size="sm" />
          ) : (
            <Box>
              <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
            </Box>
          )}
        </Pressable>
      );
    }

    if (state === 'available' || state === 'ready') {
      return (
        <Pressable
          display="flex"
          flexDirection="row"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={() => {
            if (state === 'available') {
              if (!platformEnv.supportAutoUpdate) {
                // Narrowing type to VersionInfo
                if (latest !== undefined && 'package' in latest) {
                  appUpdates.openAppUpdate(latest);
                }
              } else {
                onDownloadUpdate();
              }
            }
            if (state === 'ready') {
              onInstallUpdate();
            }
          }}
        >
          <Icon name="RocketLaunchOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            {intl.formatMessage({
              id:
                state === 'available'
                  ? 'action__update_available'
                  : 'action__restart_n_update',
            })}
          </Text>
          {showAvailabelBadge && (
            <Box rounded="full" p="2px" pr="9px">
              <Box rounded="full" bgColor="interactive-default" size="8px" />
            </Box>
          )}
          <Box>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Box>
        </Pressable>
      );
    }

    if (state === 'downloading') {
      return (
        <Pressable
          display="flex"
          flexDirection="row"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          disabled
        >
          <Icon name="RocketLaunchOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            {intl.formatMessage(
              { id: 'form__update_downloading' },
              {
                0: `${Math.floor(progress.percent)}%`,
              },
            )}
          </Text>
          <Box>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Box>
        </Pressable>
      );
    }

    return null;
  }, [
    state,
    onCheckUpdate,
    intl,
    showAvailabelBadge,
    latest,
    onDownloadUpdate,
    onInstallUpdate,
    progress.percent,
  ]);

  return (
    <>
      {Content}
      {platformEnv.supportAutoUpdate && (
        <Pressable
          display="flex"
          flexDirection="row"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
        >
          <Icon name="ArrowDownTrayOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            {intl.formatMessage({ id: 'form__download_when_available' })}
          </Text>
          <Switch
            labelType="false"
            isChecked={autoDownload}
            onToggle={() =>
              dispatch(setUpdateSetting({ autoDownload: !autoDownload }))
            }
          />
        </Pressable>
      )}
    </>
  );
};

export default AutoUpdateSectionItem;
