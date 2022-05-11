import React, { FC, useLayoutEffect } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Markdown, Modal } from '@onekeyhq/components';
import useOpenBrowser from '@onekeyhq/kit/src/hooks/useOpenBrowser';
import {
  UpdateFeatureModalRoutes,
  UpdateFeatureRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/UpdateFeature';

type RouteProps = RouteProp<
  UpdateFeatureRoutesParams,
  UpdateFeatureModalRoutes.UpdateFeatureModal
>;

const UpdateFeature: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { openUrlExternal } = useOpenBrowser();
  const route = useRoute<RouteProps>();
  const { version } = route.params;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: intl.formatMessage({ id: 'transaction__history' }),
    });
  }, [intl, navigation]);

  return (
    <Modal
      size="sm"
      maxHeight={640}
      header={`What’s new in OneKey ${process.env.VERSION ?? '0.0.0'}`}
      onSecondaryActionPress={() => navigation.goBack()}
      primaryActionTranslationId="action__update"
      secondaryActionTranslationId="action__close"
      onPrimaryActionPress={() => {
        openUrlExternal(version.package.download);
      }}
      scrollViewProps={{
        children: <Markdown>{version?.changeLog}</Markdown>,
      }}
    />
  );
};

export default UpdateFeature;
