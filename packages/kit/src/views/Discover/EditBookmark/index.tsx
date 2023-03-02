import { useCallback, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Form, Modal, ToastManager, useForm } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';

import type { DiscoverModalRoutes, DiscoverRoutesParams } from '../type';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  DiscoverRoutesParams,
  DiscoverModalRoutes.EditBookmark
>;

export const EditBookmark = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const bookmarks = useAppSelector((s) => s.discover.bookmarks);

  const bookmark = useMemo(() => {
    const item = bookmarks?.find((o) => o.id === route.params.bookmark.id);
    return item ?? route.params.bookmark;
  }, [route.params.bookmark, bookmarks]);

  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<{ name: string; url: string }>({
    defaultValues: { name: bookmark.title ?? 'Unknown', url: bookmark.url },
    mode: 'onChange',
  });

  const onPress = useCallback(
    (data: { name: string; url: string }) => {
      backgroundApiProxy.serviceDiscover.editFavorite({
        id: bookmark.id,
        url: data.url,
        title: data.name,
      });
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__change_saved' }),
      });
      navigation.goBack();
    },
    [bookmark, intl, navigation],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__edit' })}
      hideSecondaryAction
      primaryActionProps={{
        isDisabled: !isValid,
        onPress: () => handleSubmit(onPress)(),
      }}
      primaryActionTranslationId="action__save"
    >
      <Box>
        <Form>
          <Form.Item
            control={control}
            name="name"
            label={intl.formatMessage({ id: 'form__name' })}
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: 'form__field_is_required',
                }),
              },
            }}
          >
            <Form.Input
              size="lg"
              placeholder={intl.formatMessage({
                id: 'form__enter_address_name',
              })}
            />
          </Form.Item>
          <Form.Item
            control={control}
            name="url"
            label={intl.formatMessage({ id: 'form__url' })}
            rules={{
              pattern: {
                value: /https?:\/\//,
                message: intl.formatMessage({
                  id: 'form__blockchain_explorer_url_invalid',
                }),
              },
              required: {
                value: true,
                message: intl.formatMessage({
                  id: 'form__field_is_required',
                }),
              },
            }}
          >
            <Form.Input
              size="lg"
              placeholder={intl.formatMessage({
                id: 'form__enter_address_name',
              })}
            />
          </Form.Item>
        </Form>
      </Box>
    </Modal>
  );
};
