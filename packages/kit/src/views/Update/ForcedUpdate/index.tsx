import type { FC } from 'react';
import { useEffect, useLayoutEffect, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Center,
  Markdown,
  Modal,
  Spinner,
  Typography,
} from '@onekeyhq/components';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import type {
  UpdateFeatureModalRoutes,
  UpdateFeatureRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/UpdateFeature';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';

import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  UpdateFeatureRoutesParams,
  UpdateFeatureModalRoutes.ForcedUpdateModal
>;

const ForcedUpdate: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { version: currentVersion } = useSettings();

  const { versionInfo } = useRoute<RouteProps>().params;
  const [changeLog, setChangeLog] = useState<string>();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: intl.formatMessage({ id: 'transaction__history' }),
    });
  }, [intl, navigation]);

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
      closeOnOverlayClick={false}
      size="sm"
      headerShown={false}
      maxHeight={560}
      header={intl.formatMessage({ id: 'modal__update_resources' })}
      hideSecondaryAction
      primaryActionTranslationId="action__update_now"
      primaryActionProps={{
        type: 'primary',
      }}
      closeAction={() => {}}
      onPrimaryActionPress={() => appUpdates.openAppUpdate(versionInfo)}
      scrollViewProps={{
        children: changeLog ? (
          <>
            <Typography.DisplayMedium>
              {intl.formatMessage(
                { id: 'modal__what_is_new_in_onekey_str' },
                { 0: versionInfo.package.version },
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
