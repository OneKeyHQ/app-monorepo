import React, { FC } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { Column, Row, SimpleGrid } from 'native-base';
import { useIntl } from 'react-intl';

import { Box, Image, Modal, Text } from '@onekeyhq/components';
import {
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes,
} from '@onekeyhq/kit/src/routes/Modal/HistoryRequest';

import { commentList } from './MockData';

type RouteProps = RouteProp<
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes.TicketDetailModal
>;

function isMe(submitterId: number, authorId: number) {
  return submitterId === authorId;
}

export const TicketDetail: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { submitterId } = route?.params.order;
  const imageSize = (260 - 16) / 3;

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__request_details' })}
      hideSecondaryAction
      primaryActionProps={{
        type: 'basic',
      }}
      primaryActionTranslationId="action__reply"
      scrollViewProps={{
        children: [
          <Column space="24px" paddingBottom="40px">
            {commentList.comments.map((item, index) => {
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
                            <Box
                              key={`attachment${_index}`}
                              size={imageSize}
                              // marginRight="8px"
                              // marginTop="12px"
                            >
                              <Image
                                src={attachment.content_url}
                                flex={1}
                                borderRadius="12px"
                              />
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
                      Jul 27, 00:32
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
