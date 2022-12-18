import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIsFocused } from '@react-navigation/native';
import axios from 'axios';
import { SimpleGrid } from 'native-base';
import { useIntl } from 'react-intl';

import { Box, Modal, NetImage, Text } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useSettings } from '../../../hooks/redux';
import useFormatDate from '../../../hooks/useFormatDate';

import { attachmentUri, commentsUri } from './TicketService';
import { HistoryRequestRoutes } from './types';

import type {
  AttachmentsType,
  CommentType,
  HistoryRequestModalRoutesParams,
  RequestPayload,
} from './types';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ListRenderItem } from 'react-native';

type RouteProps = RouteProp<
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes.TicketDetailModal
>;

const Attachment: FC<AttachmentsType> = ({ id, size }) => {
  const { instanceId } = useSettings();
  const [data, updateData] = useState('');

  useEffect(() => {
    axios
      .get<{ data: string }>(attachmentUri(id, instanceId))
      .then((response) => {
        if (response.data) {
          updateData(response.data.data);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return (
    <>
      {data.length > 0 ? (
        <NetImage
          key={data}
          width={`${size}px`}
          height={`${size}px`}
          src={data}
          borderRadius="12px"
          preview
          bgColor="surface-selected"
        />
      ) : (
        <Box
          width={size}
          height={size}
          bgColor="surface-selected"
          borderRadius="12px"
        />
      )}
    </>
  );
};

type NavigationProps = NativeStackNavigationProp<
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes.ReplyTicketModel
>;

function platformValue(): string {
  if (platformEnv.isNativeIOS) {
    return 'App on iOS';
  }
  if (platformEnv.isNativeAndroid) {
    return 'App on Android';
  }
  if (platformEnv.isDesktop) {
    return 'App on Desktop';
  }
  if (platformEnv.isRuntimeBrowser) {
    return 'App on Browser';
  }
  return 'Hardware';
}

function isMe(submitterId: number, authorId: number) {
  return submitterId === authorId;
}
export const TicketDetail: FC = () => {
  const intl = useIntl();
  const isFocused = useIsFocused();
  const route = useRoute<RouteProps>();
  const { id } = route?.params.order || {};
  const submitterId = route.params.order.submitter_id;
  const imageSize = (260 - 16) / 3;
  const navigation = useNavigation<NavigationProps>();
  const { version } = useSettings();
  const { instanceId } = useSettings();
  const { formatDate } = useFormatDate();
  const [comments, updateComments] = useState<CommentType[]>([]);

  const renderItem: ListRenderItem<CommentType> = useCallback(
    ({ item, index }) => {
      const isMine = isMe(item.author_id, submitterId);
      let { body } = item;
      if (index === 0) {
        const platform = platformValue();
        body = `${body}\n\n${platform}\nAppVersion: ${version}`;
      }
      return (
        <Box
          flex={1}
          flexDirection="row"
          justifyContent={isMine ? 'flex-end' : 'flex-start'}
        >
          <Box flexDirection="column" paddingBottom="24px">
            <Box
              flexDirection="column"
              bgColor="surface-default"
              padding="16px"
              borderRadius="12px"
              flex={1}
            >
              <Text
                selectable
                maxWidth="260px"
                typography={{ sm: 'Body1', md: 'Body2' }}
                mb={item.attachments.length > 0 ? '12px' : '0px'}
              >
                {body}
              </Text>
              {item.attachments.length > 0 ? (
                <SimpleGrid columns={3} spacingX={2} spacingY={3} mt="12px">
                  {item.attachments.map((attachment, _index) => (
                    <Box key={`attachment${_index}`} size={imageSize}>
                      <Attachment {...attachment} size={imageSize} />
                    </Box>
                  ))}
                </SimpleGrid>
              ) : null}
            </Box>
            <Text
              mt="8px"
              typography="Body2"
              color="text-subdued"
              textAlign={isMine ? 'right' : 'left'}
            >
              {formatDate(item.created_at, { hideYear: true })}
            </Text>
          </Box>
        </Box>
      );
    },
    [formatDate, imageSize, submitterId, version],
  );

  const getData = useCallback(() => {
    axios
      .get<RequestPayload<CommentType[]>>(commentsUri(id, instanceId))
      .then((response) => {
        updateComments(response.data.data);
      })
      .catch(() => {});
  }, [id, instanceId]);

  useEffect(() => {
    if (isFocused) {
      getData();
    }
  }, [getData, isFocused]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__request_details' })}
      hideSecondaryAction
      primaryActionProps={{
        type: 'basic',
      }}
      primaryActionTranslationId="action__reply"
      onPrimaryActionPress={() => {
        navigation.navigate(HistoryRequestRoutes.ReplyTicketModel, {
          order: route?.params.order,
        });
      }}
      flatListProps={{
        height: '420px',
        data: comments,
        // @ts-ignore
        renderItem,
        keyExtractor: (item) => (item as CommentType).created_at,
      }}
    />
  );
};

export default TicketDetail;
