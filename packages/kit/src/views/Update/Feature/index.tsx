import React, { FC, useEffect, useLayoutEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Center,
  Markdown,
  Modal,
  Spinner,
  Typography,
} from '@onekeyhq/components';

import {
  UpdateFeatureModalRoutes,
  UpdateFeatureRoutesParams,
} from '../../../routes/Modal/UpdateFeature';
import appUpdates from '../../../utils/updates/AppUpdates';

type RouteProps = RouteProp<
  UpdateFeatureRoutesParams,
  UpdateFeatureModalRoutes.UpdateFeatureModal
>;

const UpdateFeature: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();

  const { oldVersion, newVersion } = useRoute<RouteProps>().params;
  const [changeLog, setChangeLog] = useState<string>();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: intl.formatMessage({ id: 'transaction__history' }),
    });
  }, [intl, navigation]);

  useEffect(() => {
    appUpdates.getChangeLog(oldVersion, newVersion).then((log) => {
      setChangeLog(log);
    });
  }, [oldVersion, newVersion]);

  return (
    <Modal
      size="sm"
      headerShown={false}
      maxHeight={560}
      hideSecondaryAction
      primaryActionTranslationId="action__close"
      primaryActionProps={{
        type: 'basic',
      }}
      onPrimaryActionPress={() => navigation.goBack()}
      scrollViewProps={{
        children: changeLog ? (
          <>
            <Typography.DisplayMedium>
              {intl.formatMessage(
                { id: 'modal__what_is_new_in_onekey_str' },
                { 0: newVersion },
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

export default UpdateFeature;
