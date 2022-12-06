import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import axios from 'axios';
import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';
import { ListRenderItem, useWindowDimensions } from 'react-native';

import {
  Alert,
  Box,
  Divider,
  Empty,
  Icon,
  Modal,
  Pressable,
  Spinner,
  Text,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useSettings } from '../../../hooks/redux';
import useFormatDate from '../../../hooks/useFormatDate';
import { SubmitRequestRoutes } from '../../../routes';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';

import { listUri } from './TicketService';
import {
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes,
  TicketType,
} from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes.TicketDetailModal
>;

type PageStatusType = 'empty' | 'network' | 'loading' | 'data';
export const HistoryRequest: FC = () => {
  const intl = useIntl();
  const { instanceId } = useSettings();
  const { formatDate } = useFormatDate();
  const { width } = useWindowDimensions();

  const navigation = useNavigation<NavigationProps>();
  const [historyList, updateHistoryList] = useState<TicketType[]>([]);
  const [pageStatus, setPageStatus] = useState<PageStatusType>('loading');
  const getData = useCallback(() => {
    setPageStatus('loading');
    axios
      .get(listUri(instanceId))
      .then((response) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (response.data.success) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const data = response.data.data as TicketType[];
          setPageStatus(data.length > 0 ? 'data' : 'empty');
          updateHistoryList(data);
        }
      })
      .catch(() => {
        setPageStatus('network');
      });
  }, [instanceId]);

  const SubmitRequestAction = () => {
    if (platformEnv.isExtensionUiPopup) {
      backgroundApiProxy.serviceApp.openExtensionExpandTab({
        routes: [RootRoutes.Modal, ModalRoutes.SubmitRequest],
        params: {
          screen: SubmitRequestRoutes.SubmitRequestModal,
        },
      });
      setTimeout(() => {
        window.close();
      }, 300);
    } else {
      navigation.navigate(HistoryRequestRoutes.SubmitRequestModal);
    }
  };

  const HintView = useMemo(
    () => (
      <Alert
        dismiss
        alertType="info"
        title={intl.formatMessage({
          id: 'conten__please_be_patient_as_net_work',
        })}
      />
    ),
    [intl],
  );

  const noData = () => {
    switch (pageStatus) {
      case 'network':
        return (
          <Empty
            emoji="🌐"
            title={intl.formatMessage({ id: 'title__no_connection' })}
            subTitle={intl.formatMessage({
              id: 'title__no_connection_desc',
            })}
            actionTitle={intl.formatMessage({
              id: 'action__retry',
            })}
            handleAction={() => getData()}
          />
        );
      case 'empty':
        return (
          <>
            <Empty
              emoji="💬"
              title={intl.formatMessage({ id: 'title__no_request_history' })}
              subTitle={intl.formatMessage({
                id: 'title__no_request_history_desc',
              })}
              actionTitle={intl.formatMessage({
                id: 'form__submit_a_request',
              })}
              handleAction={SubmitRequestAction}
            />
            <Box position="absolute" top={0} width={`${width - 32}px`}>
              {HintView}
            </Box>
          </>
        );
      case 'loading':
        return <Spinner size="sm" />;
      default:
        return null;
    }
  };

  const renderItem: ListRenderItem<TicketType> = useCallback(
    ({ item }) => {
      const platformWithField = (value: string) => {
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
      };

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
            navigation.navigate(HistoryRequestRoutes.TicketDetailModal, {
              order: item,
            });
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
                <Text typography="Body2" numberOfLines={1} color="text-subdued">
                  {item.description}
                </Text>
                <Text typography="Body2" color="text-subdued">
                  {formatDate(item.created_at, {
                    hideYear: true,
                  })}
                </Text>
              </Column>
              <Icon name="ChevronRightMini" size={20} />
            </Row>
          </Row>
        </Pressable>
      );
    },
    [formatDate, intl, navigation],
  );

  useEffect(() => {
    getData();
  }, [getData]);

  return (
    <Modal
      height="560px"
      header={intl.formatMessage({ id: 'form__s_request_history' })}
      footer={pageStatus === 'data' ? undefined : null}
      hideSecondaryAction
      hidePrimaryAction={!(pageStatus === 'data')}
      primaryActionProps={{
        type: 'basic',
      }}
      onPrimaryActionPress={SubmitRequestAction}
      primaryActionTranslationId="form__submit_a_request"
      // @ts-ignore
      flatListProps={
        pageStatus === 'data'
          ? {
              height: '560px',
              data: historyList,
              // @ts-ignore
              renderItem,
              ListHeaderComponent: () => <Box mb="16px">{HintView}</Box>,
              ItemSeparatorComponent: () => (
                <Divider height="24px" bgColor="surface-subdued" />
              ),
              keyExtractor: (item) => (item as TicketType).created_at,
            }
          : undefined
      }
    >
      {pageStatus !== 'data' ? (
        <Box flex={1} alignItems="center" justifyContent="center">
          {noData()}
        </Box>
      ) : null}
    </Modal>
  );
};

export default HistoryRequest;
