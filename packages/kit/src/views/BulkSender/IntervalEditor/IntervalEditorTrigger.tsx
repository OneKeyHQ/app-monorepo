import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { TxSettingTrigger } from '../TxSetting/TxSettingTrigger';
import { BulkSenderRoutes, IntervalTypeEnum } from '../types';

type Props = {
  intervalType: IntervalTypeEnum;
  txInterval: string[];
  handleOnIntervalChanged: ({
    txInterval,
    intervalType,
  }: {
    txInterval: string[];
    intervalType: IntervalTypeEnum;
  }) => void;
};

function IntervalEditorTrigger(props: Props) {
  const { intervalType, txInterval, handleOnIntervalChanged } = props;

  const intl = useIntl();
  const navigation = useNavigation();

  const handleOpenIntervalSelector = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.BulkSender,
      params: {
        screen: BulkSenderRoutes.IntervalEditor,
        params: {
          txInterval,
          intervalType,
          onIntervalChanged: handleOnIntervalChanged,
        },
      },
    });
  }, [handleOnIntervalChanged, intervalType, navigation, txInterval]);

  const { title, desc } = useMemo(() => {
    switch (intervalType) {
      case IntervalTypeEnum.Off:
        return {
          title: 'Off',
        };
      case IntervalTypeEnum.Fixed:
        return {
          title: `${txInterval[0]}s`,
          desc: intl.formatMessage({ id: 'form__fixed_interval' }),
        };
      case IntervalTypeEnum.Random:
        return {
          title: `${txInterval[0]} ~ ${txInterval[1]}s`,
          desc: intl.formatMessage({ id: 'form__random_interval' }),
        };
      default:
        return {
          title: `${txInterval[0]} ~ ${txInterval[1]}s`,
          desc: intl.formatMessage({ id: 'form__random_interval' }),
        };
    }
  }, [intervalType, intl, txInterval]);

  return (
    <TxSettingTrigger
      header={intl.formatMessage({ id: 'form__time_interval' })}
      title={title}
      desc={desc}
      onPress={handleOpenIntervalSelector}
    />
  );
}

export { IntervalEditorTrigger };
