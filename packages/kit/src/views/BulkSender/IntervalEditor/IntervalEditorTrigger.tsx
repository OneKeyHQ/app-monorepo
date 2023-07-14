import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';

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
          desc: 'Fixed Interval',
        };
      case IntervalTypeEnum.Random:
        return {
          title: `${txInterval[0]} ~ ${txInterval[1]}s`,
          desc: 'Random Interval',
        };
      default:
        return {
          title: `${txInterval[0]} ~ ${txInterval[1]}s`,
          desc: 'Random Interval',
        };
    }
  }, [intervalType, txInterval]);

  return (
    <TxSettingTrigger
      header="Time Interval"
      title={title}
      desc={desc}
      onPress={handleOpenIntervalSelector}
    />
  );
}

export { IntervalEditorTrigger };
