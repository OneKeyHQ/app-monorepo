import type { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Icon,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import { useAutoUpdate, useSettings } from '@onekeyhq/kit/src/hooks/redux';
import { useCheckUpdate } from '@onekeyhq/kit/src/hooks/useCheckUpdate';

const UpdateItem: FC = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { state, progress } = useAutoUpdate();
  const { showUpdateBadge } = useCheckUpdate();
  const { autoDownload = true } = useSettings().updateSetting ?? {};

  let formText = '';
  const disabled = state === 'downloading';
  if (state === 'available') {
    formText = intl.formatMessage({ id: 'action__update_available' });
  } else if (state === 'ready') {
    formText = intl.formatMessage({ id: 'action__restart_n_update' });
  } else if (!autoDownload && state === 'downloading') {
    formText = intl.formatMessage(
      { id: 'form__update_downloading' },
      {
        0: `${Math.floor(progress.percent)}%`,
      },
    );
  }

  if (!formText) {
    return null;
  }

  return (
    <>
      <Divider />
      <PressableItem
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        py={{ base: '12px', sm: '8px' }}
        px={{ base: '16px', sm: '8px' }}
        mt="4px"
        bg="transparent"
        borderRadius="12px"
        onPress={() => {
          if (state === 'ready') {
            window.desktopApi.installUpdate();
          } else {
            window.desktopApi.downloadUpdate();
          }
        }}
        disabled={disabled}
      >
        <Box flexDirection="row" alignItems="center">
          <Icon size={isVerticalLayout ? 24 : 20} name="UploadOutline" />
          <Text
            typography={isVerticalLayout ? 'Body1Strong' : 'Body2Strong'}
            ml="12px"
          >
            {formText}
          </Text>
        </Box>

        {showUpdateBadge && (
          <Box rounded="full" p="2px" pr="9px">
            <Box rounded="full" bgColor="interactive-default" size="8px" />
          </Box>
        )}
      </PressableItem>
    </>
  );
};

export default UpdateItem;
