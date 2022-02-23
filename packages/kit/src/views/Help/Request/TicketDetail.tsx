import React, { FC, useEffect, useMemo, useRef } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIsFocused } from '@react-navigation/native';
import { format, parseISO } from 'date-fns';
import { Column, Row, SimpleGrid } from 'native-base';
import { useIntl } from 'react-intl';
import { ScrollView } from 'react-native';
import useSWR from 'swr';

import { Box, Image, Modal, Text, useLocale } from '@onekeyhq/components';
import {
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes,
} from '@onekeyhq/kit/src/routes/Modal/HistoryRequest';

import { useSettings } from '../../../hooks/redux';

import { attachmentUri, commentsUri } from './TicketService';
import { AttachmentsType, CommentType, RequestPayload, local } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes.TicketDetailModal
>;

const Attachment: FC<AttachmentsType> = ({ id }) => {
  const { instanceId } = useSettings();

  const { data } = useSWR<RequestPayload<string>>(
    attachmentUri(id, instanceId),
  );

  const attachment = useMemo(() => {
    if (data) {
      return <Image source={{ uri: data.data }} flex={1} borderRadius="12px" />;
    }
    return null;
  }, [data]);
  return attachment;
};

type NavigationProps = NativeStackNavigationProp<
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes.ReplyTicketModel
>;

function isMe(submitterId: number, authorId: number) {
  return submitterId === authorId;
}
export const TicketDetail: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { id } = route?.params.order;
  const submitterId = route.params.order.submitter_id;
  const imageSize = (260 - 16) / 3;
  const navigation = useNavigation<NavigationProps>();
  const isFocused = useIsFocused();
  const { instanceId } = useSettings();
  const { locale } = useLocale();

  const { data, mutate } = useSWR<RequestPayload<CommentType[]>>(
    commentsUri(id, instanceId),
  );

  let comments: CommentType[] = [];

  if (data) {
    comments = data.data;
  }
  const scrollViewRef = useRef<ScrollView>();

  useEffect(() => {
    if (isFocused) {
      mutate();
    }
  }, [isFocused, mutate]);
  return (
    <Modal
      header={intl.formatMessage({ id: 'action__reply' })}
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
      scrollViewProps={{
        ref: scrollViewRef,
        onContentSizeChange: () =>
          scrollViewRef?.current?.scrollToEnd?.({ animated: false }),
        children: [
          <Column space="24px" paddingBottom="40px">
            {comments.map((item, index) => {
              const isMine = isMe(item.author_id, submitterId);
              let { body } = item;
              if (index === 0) {
                body = `${body}\n\nApp on iOS\nAppVersion: 1.0.2`;
              }
              return (
                <Row justifyContent={isMine ? 'flex-end' : 'flex-start'}>
                  <Column paddingBottom="24px" space="8px">
                    <Column
                      bgColor="surface-default"
                      padding="16px"
                      borderRadius="12px"
                      flex={1}
                    >
                      <Text
                        selectable
                        maxWidth="260px"
                        typography={{ sm: 'Body1', md: 'Body2' }}
                      >
                        {body}
                      </Text>
                      {item.attachments.length > 0 ? (
                        <SimpleGrid
                          columns={3}
                          spacingX={2}
                          spacingY={3}
                          mt="12px"
                        >
                          {item.attachments.map((attachment, _index) => (
                            <Box key={`attachment${_index}`} size={imageSize}>
                              <Attachment {...attachment} />
                            </Box>
                          ))}
                        </SimpleGrid>
                      ) : null}
                    </Column>
                    <Text
                      typography="Body2"
                      color="text-subdued"
                      textAlign={isMine ? 'right' : 'left'}
                    >
                      {format(parseISO(item.created_at), 'LLL, HH:mm', {
                        locale: local(locale),
                      })}
                    </Text>
                  </Column>
                </Row>
              );
            })}
          </Column>,
        ],
      }}
    />
  );
};

export default TicketDetail;
