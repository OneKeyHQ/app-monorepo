import React, { FC, useEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIsFocused } from '@react-navigation/native';
import { Center, Column, Row } from 'native-base';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

import {
  Box,
  Empty,
  Icon,
  Modal,
  Pressable,
  Spinner,
  Text,
} from '@onekeyhq/components';
import {
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes,
} from '@onekeyhq/kit/src/routes/Modal/HistoryRequest';

import { useSettings } from '../../../hooks/redux';
import useFormatDate from '../../../hooks/useFormatDate';

import { listUri } from './TicketService';
import { RequestPayload, TicketType } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes.TicketDetailModal
>;

export const HistoryRequest: FC = () => {
  const intl = useIntl();
  const isFocused = useIsFocused();
  const { instanceId } = useSettings();
  const { formatDate } = useFormatDate();

  function platformWithField(value: string): string {
    switch (value) {
      case 'hardware':
        return intl.formatMessage({ id: 'form__hardware' });
      case 'app_on_android':
        return intl.formatMessage({ id: 'form__app_on_android' });
      case 'app_on_ios':
        return intl.formatMessage({ id: 'form__app_on_ios' });
      case 'app_on_desktop':
        return intl.formatMessage({ id: 'form__app_on_desktop' });
      case 'app_on_browser':
        return intl.formatMessage({ id: 'form__app_on_browser' });
      default:
        return value;
    }
  }
  const navigation = useNavigation<NavigationProps>();

  const { data, error, mutate } = useSWR<RequestPayload<TicketType[]>>(
    listUri(instanceId),
  );

  let isEmpty = true;
  let historyList: TicketType[] = [];

  if (data) {
    historyList = data.data;
    isEmpty = historyList.length === 0;
  }

  const noData = () => {
    if (error) {
      return (
        <Empty
          icon="StatusOfflineSolid"
          title={intl.formatMessage({ id: 'title__no_connection' })}
          subTitle={intl.formatMessage({
            id: 'title__no_connection_desc',
          })}
          actionTitle={intl.formatMessage({
            id: 'action__retry',
          })}
          handleAction={() => mutate()}
        />
      );
    }
    if (!data) {
      return <Spinner size="sm" />;
    }

    return (
      <Empty
        title={intl.formatMessage({ id: 'title__no_request_history' })}
        subTitle={intl.formatMessage({
          id: 'title__no_request_history_desc',
        })}
        actionTitle={intl.formatMessage({
          id: 'form__submit_a_request',
        })}
        handleAction={() => {
          navigation.navigate(HistoryRequestRoutes.SubmitRequestModal);
        }}
      />
    );
  };

  useEffect(() => {
    if (isFocused) {
      mutate();
    }
  }, [isFocused, mutate]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'form__s_request_history' })}
      hideSecondaryAction
      hidePrimaryAction={isEmpty}
      primaryActionProps={{
        type: 'basic',
      }}
      onPrimaryActionPress={() => {
        navigation.navigate(HistoryRequestRoutes.SubmitRequestModal);
      }}
      primaryActionTranslationId="form__submit_a_request"
      scrollViewProps={
        !isEmpty
          ? {
              children: [
                <Column space="24px" paddingBottom="40px">
                  {historyList.map((item) => {
                    let platform = '';
                    item.custom_fields.forEach((field) => {
                      if (field.id === 360013393195) {
                        platform = field.value;
                      }
                    });
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          navigation.navigate(
                            HistoryRequestRoutes.TicketDetailModal,
                            {
                              order: item,
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
                                {platformWithField(platform)}
                              </Text>
                              <Text
                                typography="Body2"
                                numberOfLines={1}
                                color="text-subdued"
                              >
                                {item.description}
                              </Text>
                              <Text typography="Body2" color="text-subdued">
                                {formatDate(item.created_at, {
                                  hideYear: true,
                                })}
                              </Text>
                            </Column>
                            <Icon name="ChevronRightSolid" size={20} />
                          </Row>
                        </Row>
                      </Pressable>
                    );
                  })}
                </Column>,
              ],
            }
          : undefined
      }
    >
      {isEmpty ? (
        <Box height="420px">
          <Center flex={1}>{noData()}</Center>
        </Box>
      ) : null}
    </Modal>
  );
};

export default HistoryRequest;
