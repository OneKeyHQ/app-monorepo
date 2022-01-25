import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/core';
import { Center, Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import { Box, Empty, Icon, Modal, Pressable, Text } from '@onekeyhq/components';
import {
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes,
} from '@onekeyhq/kit/src/routes/Modal/HistoryRequest';

import { historyList } from './MockData';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes.TicketDetailModal
>;

export const HistoryRequest: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const isEmpty = historyList.count === 0;

  return (
    <Modal
      header={intl.formatMessage({ id: 'form__s_request_history' })}
      hideSecondaryAction
      hidePrimaryAction={isEmpty}
      // footer={null}
      primaryActionProps={{
        type: 'basic',
      }}
      primaryActionTranslationId="form__submit_a_request"
      scrollViewProps={
        !isEmpty
          ? {
              children: [
                <Column space="24px" paddingBottom="40px">
                  {historyList.results.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        navigation.navigate(
                          HistoryRequestRoutes.TicketDetailModal,
                          {
                            order: {
                              id: item.id,
                              submitterId: item.submitter_id,
                            },
                          },
                        );
                      }}
                    >
                      <Row
                        bgColor="surface-default"
                        height="96px"
                        padding="16px"
                        borderRadius="12px"
                      >
                        <Row flex={1} alignItems="center" space="12px">
                          <Column flex={1}>
                            <Text
                              typography={{
                                sm: 'Body1Strong',
                                md: 'Body2Strong',
                              }}
                            >
                              {/* {item.custom_fields} */}
                              App on iOS
                            </Text>
                            <Text
                              typography="Body2"
                              numberOfLines={1}
                              color="text-subdued"
                            >
                              {item.description}
                            </Text>
                            <Text typography="Body2" color="text-subdued">
                              {item.created_at}
                            </Text>
                          </Column>
                          <Icon name="ChevronRightSolid" size={20} />
                        </Row>
                      </Row>
                    </Pressable>
                  ))}
                </Column>,
              ],
            }
          : undefined
      }
    >
      {isEmpty ? (
        <Box height="full">
          <Center flex={1}>
            <Empty
              title={intl.formatMessage({ id: 'title__no_request_history' })}
              subTitle={intl.formatMessage({
                id: 'title__no_request_history_desc',
              })}
              actionTitle={intl.formatMessage({ id: 'form__submit_a_request' })}
              handleAction={() => {}}
            />
          </Center>
        </Box>
      ) : null}
    </Modal>
  );
};

export default HistoryRequest;
