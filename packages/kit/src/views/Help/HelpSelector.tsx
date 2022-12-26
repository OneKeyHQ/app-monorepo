import type { FC } from 'react';
import { useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  Box,
  Center,
  Icon,
  Select,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { SubmitRequestModalRoutesParams } from '@onekeyhq/kit/src/routes';
import { SubmitRequestRoutes } from '@onekeyhq/kit/src/routes';
import type {
  HomeRoutesParams,
  ModalScreenProps,
} from '@onekeyhq/kit/src/routes/types';
import {
  HomeRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useHelpLink } from '../../hooks/useHelpLink';

import { HistoryRequestRoutes } from './Request/types';

import type { HistoryRequestModalRoutesParams } from './Request/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = ModalScreenProps<SubmitRequestModalRoutesParams> &
  ModalScreenProps<HistoryRequestModalRoutesParams>;

type StackNavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

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
      if (platformEnv.isNative) {
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
            name: isSmallScreen
              ? 'ChatBubbleBottomCenterTextOutline'
              : 'ChatBubbleBottomCenterTextMini',
          },
        },
        {
          label: intl.formatMessage({ id: 'form__s_request_history' }),
          value: 'history',
          iconProps: {
            name: isSmallScreen ? 'ClockOutline' : 'ClockMini',
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
            name: isSmallScreen ? 'LifebuoyOutline' : 'LifebuoyMini',
          },
        },
        {
          label: intl.formatMessage({ id: 'form__beginner_guide' }),
          value: 'guide',
          iconProps: {
            name: isSmallScreen ? 'MapOutline' : 'MapMini',
          },
        },
        {
          label: intl.formatMessage({ id: 'form__hardware_wallet_manuals' }),
          value: 'hardware_wallet',
          iconProps: {
            name: isSmallScreen ? 'BookOpenOutline' : 'BookOpenMini',
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
            name: isSmallScreen ? 'GlobeAltOutline' : 'GlobeAltMini',
          },
        },
        {
          label: intl.formatMessage({ id: 'title__buy_onekey_hardware' }),
          value: 'shop',
          iconProps: {
            name: isSmallScreen ? 'ShoppingBagOutline' : 'ShoppingBagMini',
          },
        },
        {
          label: intl.formatMessage({ id: 'title__client_download' }),
          value: 'download',
          iconProps: {
            name: isSmallScreen ? 'ArrowDownTrayOutline' : 'ArrowDownTrayMini',
          },
        },
      ],
    },
  ];

  const onChange = (value: string) => {
    setTimeout(() => {
      switch (value) {
        case 'submit_request':
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
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.SubmitRequest,
              params: {
                screen: SubmitRequestRoutes.SubmitRequestModal,
              },
            });
          }
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
        dropdownPosition="top-right"
        dropdownProps={isSmallScreen ? {} : { minW: '240px', height: '320px' }}
        positionTranslateY={-4}
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
            <Icon size={24} name="QuestionMarkCircleMini" />
          </Center>
        )}
      />
    </Box>
  );
};

export default HelpSelector;
