import { FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

import { getAppNavigation } from '../../../../hooks/useAppNavigation';
import { DiscoverModalRoutes } from '../../../../routes/Modal/Discover';
import { DAppItemType, SectionDataType } from '../../type';

export const SectionTitle: FC<SectionDataType> = ({
  title,
  data,
  onItemSelect,
}) => {
  const intl = useIntl();
  const isSmallScreen = useIsVerticalLayout();

  const onSelected = useCallback(
    (item: DAppItemType) => {
      onItemSelect?.(item);
      // use root nav instead of tab nav to goback
      getAppNavigation().goBack();
    },
    [onItemSelect],
  );

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      pl={isSmallScreen ? '16px' : '32px'}
      pr={isSmallScreen ? '8px' : '32px'}
      mb="14px"
    >
      <Box flex={1}>
        <Typography.Heading numberOfLines={1}>{title}</Typography.Heading>
      </Box>
      <Button
        onPress={() => {
          getAppNavigation().navigate(RootRoutes.Modal, {
            screen: ModalRoutes.Discover,
            params: {
              screen: DiscoverModalRoutes.DAppListModal,
              params: {
                data,
                title,
                onItemSelect: onSelected,
              },
            },
          });
        }}
        height="32px"
        type="plain"
        size="sm"
        rightIconName="ChevronRightSolid"
        textProps={{ color: 'text-subdued' }}
      >
        {intl.formatMessage({ id: 'action__see_all' })}
      </Button>
    </Box>
  );
};
