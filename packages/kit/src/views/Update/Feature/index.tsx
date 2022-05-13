import React, { FC, useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Markdown, Modal } from '@onekeyhq/components';
import { useCheckVersion } from '@onekeyhq/kit/src/hooks/redux';

const UpdateFeature: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const versionStore = useCheckVersion();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: intl.formatMessage({ id: 'transaction__history' }),
    });
  }, [intl, navigation]);

  return (
    <Modal
      size="sm"
      headerShown={false}
      maxHeight={640}
      header={`What’s new in OneKey ${
        versionStore?.currentVersionFeature?.version ?? ''
      }`}
      hideSecondaryAction
      primaryActionTranslationId="action__close"
      primaryActionProps={{
        type: 'basic',
      }}
      onPrimaryActionPress={() => navigation.goBack()}
      scrollViewProps={{
        children: (
          <Markdown>{versionStore?.currentVersionFeature?.changeLog}</Markdown>
        ),
      }}
    />
  );
};

export default UpdateFeature;
