import React, { FC, useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import {
  Box,
  Center,
  ICON_NAMES,
  Icon,
  Select,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import {
  HistoryRequestModalRoutesParams,
  HistoryRequestRoutes,
  SubmitRequestModalRoutesParams,
  SubmitRequestRoutes,
} from '@onekeyhq/kit/src/routes';
import {
  HomeRoutes,
  HomeRoutesParams,
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import { useHelpLink } from '../../hooks/useHelpLink';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = ModalScreenProps<SubmitRequestModalRoutesParams> &
  ModalScreenProps<HistoryRequestModalRoutesParams>;

type StackNavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.SettingsScreen
>;

type Option = {
  label: string;
  value: string;
  iconProps: {
    name: ICON_NAMES;
  };
};

type GroupOption = {
  title: string;
  options: Option[];
};

const HelpSelector: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isSmallScreen = useIsVerticalLayout();
  const userGuideUrl = useHelpLink({ path: 'categories/360000170236' });
  const supportUrl = useHelpLink({ path: '' });
  const walletManual = useHelpLink({ path: 'articles/360002123856' });
  const stackNavigation = useNavigation<StackNavigationProps>();

  const openUrl = useCallback(
    (url: string, title?: string) => {
      console.log('url', url, 'title', title);
      if (['android', 'ios'].includes(Platform.OS)) {
        stackNavigation.navigate(HomeRoutes.SettingsWebviewScreen, {
          url,
          title,
        });
      } else {
        window.open(url, '_blank');
      }
    },
    [stackNavigation],
  );

  const options: GroupOption[] = [
    {
      title: '',
      options: [
        {
          label: intl.formatMessage({ id: 'form__submit_a_request' }),
          value: 'submit_request',
          iconProps: {
            name: 'AnnotationOutline',
          },
        },
        {
          label: intl.formatMessage({ id: 'form__s_request_history' }),
          value: 'history',
          iconProps: {
            name: 'ClockOutline',
          },
        },
      ],
    },
    {
      title: '',
      options: [
        {
          label: intl.formatMessage({ id: 'form__help_support' }),
          value: 'support',
          iconProps: {
            name: 'AnnotationOutline',
          },
        },
        {
          label: intl.formatMessage({ id: 'form__beginner_guide' }),
          value: 'guide',
          iconProps: {
            name: 'MapOutline',
          },
        },
        {
          label: intl.formatMessage({ id: 'form__hardware_wallet_manuals' }),
          value: 'hardware_wallet',
          iconProps: {
            name: 'BookmarkAltOutline',
          },
        },
      ],
    },
    {
      title: '',
      options: [
        {
          label: intl.formatMessage({ id: 'title__official_website' }),
          value: 'website',
          iconProps: {
            name: 'GlobeAltOutline',
          },
        },
        {
          label: intl.formatMessage({ id: 'title__buy_onekey_hardware' }),
          value: 'shop',
          iconProps: {
            name: 'ShoppingBagOutline',
          },
        },
        {
          label: intl.formatMessage({ id: 'title__client_download' }),
          value: 'download',
          iconProps: {
            name: 'DownloadOutline',
          },
        },
      ],
    },
  ];

  const onChange = (value: string) => {
    setTimeout(() => {
      switch (value) {
        case 'submit_request':
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.SubmitRequest,
            params: {
              screen: SubmitRequestRoutes.SubmitRequestModal,
            },
          });
          break;
        case 'guide':
          openUrl(
            userGuideUrl,
            intl.formatMessage({ id: 'form__beginner_guide' }),
          );
          break;
        case 'support':
          openUrl(supportUrl, intl.formatMessage({ id: 'form__help_support' }));
          break;
        case 'hardware_wallet':
          openUrl(
            walletManual,
            intl.formatMessage({ id: 'form__hardware_wallet_manuals' }),
          );
          break;
        case 'history':
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.HistoryRequest,
            params: {
              screen: HistoryRequestRoutes.HistoryRequestModal,
            },
          });
          break;
        case 'website':
          openUrl(
            'https://help.onekey.so/hc/',
            intl.formatMessage({ id: 'title__official_website' }),
          );
          break;
        case 'shop':
          openUrl(
            'https://shop.onekey.so/',
            intl.formatMessage({ id: 'title__buy_onekey_hardware' }),
          );
          break;
        case 'download':
          openUrl(
            'https://onekey.so/download',
            intl.formatMessage({ id: 'title__client_download' }),
          );
          break;
        default:
          break;
      }
    }, 200);
  };

  return (
    <Box>
      <Select
        title={
          isSmallScreen ? intl.formatMessage({ id: 'title__help' }) : undefined
        }
        dropdownPosition="right"
        dropdownProps={
          isSmallScreen ? {} : { minW: '240px', minH: '330px', bottom: '62px' }
        }
        headerShown={false}
        options={options}
        isTriggerPlain
        footer={null}
        activatable={false}
        onChange={onChange}
        renderTrigger={() => (
          <Center
            width="50px"
            height="50px"
            bg="action-secondary-default"
            borderRadius="25px"
            borderWidth="1px"
            borderColor="border-default"
          >
            <Icon size={24} name="QuestionMarkCircleSolid" />
          </Center>
        )}
      />
    </Box>
  );
};

export default HelpSelector;
