import { FC, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Spinner,
  Text,
  useToast,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAutoUpdate } from '@onekeyhq/kit/src/hooks/redux';
import {
  available,
  enable,
} from '@onekeyhq/kit/src/store/reducers/autoUpdater';
import appUpdates from '@onekeyhq/kit/src/utils/updates/AppUpdates';

const AutoUpdateSectionItem: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const { dispatch } = backgroundApiProxy;
  const { state, progress } = useAutoUpdate();

  const onCheckUpdate = useCallback(() => {
    appUpdates
      .checkUpdate()
      ?.then((version) => {
        if (!version) {
          toast.show({
            title: intl.formatMessage({
              id: 'msg__using_latest_release',
            }),
          });
        } else {
          dispatch(enable(), available(version));
        }
      })
      .catch(() => {})
      .finally(() => {});
  }, [dispatch, intl, toast]);

  const Content = useMemo(() => {
    console.log('renderrrrrr$$$$');
    if (
      state === 'not-available' ||
      state === 'error' ||
      state === 'checking'
    ) {
      return (
        <Pressable
          display="flex"
          flexDirection="row"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={onCheckUpdate}
        >
          <Icon name="RefreshOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            {intl.formatMessage({
              id: 'form__check_for_updates',
            })}
          </Text>
          {state === 'checking' ? (
            <Spinner size="sm" />
          ) : (
            <Box>
              <Icon name="ChevronRightSolid" size={20} />
            </Box>
          )}
        </Pressable>
      );
    }

    if (state === 'available' || state === 'ready') {
      return (
        <Pressable
          display="flex"
          flexDirection="row"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          onPress={onCheckUpdate}
        >
          <Icon name="RefreshOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            {intl.formatMessage({
              id:
                state === 'available'
                  ? 'action__update_available'
                  : 'action__update_now',
            })}
          </Text>
          <Box rounded="full" p="2px" pr="9px">
            <Box rounded="full" bgColor="interactive-default" size="8px" />
          </Box>
          <Box>
            <Icon name="ChevronRightSolid" size={20} />
          </Box>
        </Pressable>
      );
    }

    if (state === 'downloading') {
      return (
        <Pressable
          display="flex"
          flexDirection="row"
          alignItems="center"
          py={4}
          px={{ base: 4, md: 6 }}
          borderBottomWidth="1"
          borderBottomColor="divider"
          disabled
        >
          <Icon name="RefreshOutline" />
          <Text
            typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            flex={1}
            mx={3}
          >
            {intl.formatMessage(
              { id: 'form__update_downloading' },
              {
                0: `${progress}%`,
              },
            )}
          </Text>
          <Box>
            <Icon name="ChevronRightSolid" size={20} />
          </Box>
        </Pressable>
      );
    }

    // TODO: web & extensions return null
    console.log(state, '=============>>>>>>>> rerender');
    return null;
  }, [state, progress, intl, onCheckUpdate]);

  return Content;
};

export default AutoUpdateSectionItem;
