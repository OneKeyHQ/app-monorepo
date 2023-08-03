import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  CheckBox,
  IconButton,
  Pressable,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import { setShowTokenDetailPriceChart } from '../../../store/reducers/settings';
import BaseMenu from '../../Overlay/BaseMenu';

import type { IBaseMenuOptions } from '../../Overlay/BaseMenu';

export const HeaderOptions: FC = () => {
  const intl = useIntl();
  const showTokenDetailPriceChart = useAppSelector(
    (s) => s.settings.showTokenDetailPriceChart,
  );

  const handleChange = useCallback(() => {
    const { dispatch } = backgroundApiProxy;
    dispatch(setShowTokenDetailPriceChart(!showTokenDetailPriceChart));
  }, [showTokenDetailPriceChart]);

  const options = useMemo(
    () =>
      [
        () => (
          <Pressable
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            py="10px"
            px={3}
            onPress={handleChange}
          >
            <Typography.Body2 flex="1">
              {intl.formatMessage({
                id: showTokenDetailPriceChart
                  ? 'action__hide_chart'
                  : 'action__show_chart',
              })}
            </Typography.Body2>
            <CheckBox
              isChecked={!!showTokenDetailPriceChart}
              mr="-12px"
              pointerEvents="none"
            />
          </Pressable>
        ),
      ] as IBaseMenuOptions,
    [intl, showTokenDetailPriceChart, handleChange],
  );

  return (
    <BaseMenu ml="26px" options={options}>
      <IconButton
        circle
        size="sm"
        name="EllipsisVerticalOutline"
        w="34px"
        h="34px"
        type="plain"
      />
    </BaseMenu>
  );
};
