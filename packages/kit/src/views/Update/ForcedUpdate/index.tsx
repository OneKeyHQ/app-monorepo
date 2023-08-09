import type { FC } from 'react';
import { useEffect, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Center,
  Markdown,
  Modal,
  Spinner,
  Typography,
} from '@onekeyhq/components';
import { SkipAppLock } from '@onekeyhq/kit/src/components/AppLock';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import useBackHandler from '@onekeyhq/kit/src/hooks/useBackHandler';
import type { UpdateFeatureRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/UpdateFeature';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';

import { selectVersion } from '../../../store/selectors';

import type { UpdateFeatureModalRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  UpdateFeatureRoutesParams,
  UpdateFeatureModalRoutes.ForcedUpdateModal
>;

const ForcedUpdate: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const currentVersion = useAppSelector(selectVersion);

  const { versionInfo } = useRoute<RouteProps>().params;
  const [changeLog, setChangeLog] = useState<string>();

  useBackHandler();

  useEffect(() => {
    const modalNav = navigation.getParent()?.getParent();
    if (modalNav) {
      modalNav.setOptions({
        gestureEnabled: false,
      });
      return () =>
        modalNav.setOptions({
          gestureEnabled: true,
        });
    }
  }, [navigation]);

  useEffect(() => {
    (async () => {
      const { forceUpdateVersion, version } = versionInfo.package;
      let changeLogs = await appUpdates.getChangeLog(
        currentVersion,
        forceUpdateVersion ?? version,
      );
      if (!changeLogs) {
        changeLogs = await appUpdates.getChangeLog(currentVersion, version);
      }
      if (!changeLogs) {
        changeLogs = intl.formatMessage({ id: 'title__major_update' });
      }
      setChangeLog(changeLogs);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal
      closeable={false}
      closeOnOverlayClick={false}
      closeAction={() => {}}
      size="sm"
      headerShown={false}
      maxHeight={560}
      hideSecondaryAction
      primaryActionTranslationId="action__update_now"
      primaryActionProps={{
        type: 'primary',
      }}
      onPrimaryActionPress={() => appUpdates.openAppUpdate(versionInfo)}
      scrollViewProps={{
        disableScrollViewPanResponder: true,
        children: changeLog ? (
          <>
            <SkipAppLock />
            <Typography.DisplayMedium>
              {intl.formatMessage(
                { id: 'modal__what_is_new_in_onekey_str' },
                { 0: versionInfo.package.forceUpdateVersion },
              )}
            </Typography.DisplayMedium>
            <Markdown>{changeLog}</Markdown>
          </>
        ) : (
          <Center>
            <Spinner size="lg" />
          </Center>
        ),
      }}
    />
  );
};

export default ForcedUpdate;
