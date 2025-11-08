import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  IconButton,
  Radio,
  SizableText,
  Switch,
  XStack,
  YStack,
  rootNavigationRef,
  startViewTransition,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  usePerpsCustomSettingsAtom,
  usePerpsUserConfigPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EPerpUserType } from '@onekeyhq/shared/types/hyperliquid/types';

import { PerpsProviderMirror } from '../PerpsProviderMirror';

enum EPerpSettingsPage {
  Main = 'main',
  InterfaceSelection = 'interfaceSelection',
}

interface IPerpSettingsDialogContentProps {
  close: () => void;
  currentPage: EPerpSettingsPage;
  setCurrentPage: (page: EPerpSettingsPage) => void;
}

function PerpSettingsDialogContent({
  close,
  currentPage,
  setCurrentPage,
}: IPerpSettingsDialogContentProps) {
  const [perpsCustomSettings, setPerpsCustomSettings] =
    usePerpsCustomSettingsAtom();
  const [{ perpUserConfig }] = usePerpsUserConfigPersistAtom();
  const intl = useIntl();

  const interfaceTypeLabel = intl.formatMessage({
    id:
      perpUserConfig.currentUserType === EPerpUserType.PERP_NATIVE
        ? ETranslations.perp_setting_interface_native_title
        : ETranslations.perp_setting_interface_web_title,
  });

  const setPerpUserConfig = useCallback(
    async (type: EPerpUserType) => {
      startViewTransition(() => {
        void backgroundApiProxy.serviceWebviewPerp.setPerpUserConfig(type);
      });
      setTimeout(() => {
        const rootState = rootNavigationRef.current?.getRootState();
        const routes = rootState?.routes;
        if (routes) {
          const routesState = routes[0].state;
          if (routesState) {
            const index = routesState.index;
            if (index !== undefined) {
              const route = routesState.routes[index];
              if (
                route.name === ETabRoutes.WebviewPerpTrade &&
                type === EPerpUserType.PERP_NATIVE
              ) {
                void rootNavigationRef.current?.navigate(
                  ERootRoutes.Main,
                  {
                    screen: ETabRoutes.Perp,
                    params: {
                      screen: ETabRoutes.Perp,
                    },
                  },
                  {
                    pop: true,
                  },
                );
              } else if (
                route.name === ETabRoutes.Perp &&
                type === EPerpUserType.PERP_WEB
              ) {
                void rootNavigationRef.current?.navigate(
                  ERootRoutes.Main,
                  {
                    screen: ETabRoutes.WebviewPerpTrade,
                    params: {
                      screen: ETabRoutes.WebviewPerpTrade,
                    },
                  },
                  {
                    pop: true,
                  },
                );
              }
            }
          }
        }
        close();
      }, 100);
    },
    [close],
  );

  // Main settings page
  if (currentPage === EPerpSettingsPage.Main) {
    return (
      <YStack gap="$5">
        <ListItem
          mx="$0"
          p="$0"
          title={intl.formatMessage({
            id: ETranslations.perp_setting_title,
          })}
          subtitle={intl.formatMessage({
            id: ETranslations.perp_setting_desc,
          })}
        >
          <Switch
            value={perpsCustomSettings.skipOrderConfirm}
            onChange={(value) => {
              setPerpsCustomSettings((prev) => ({
                ...prev,
                skipOrderConfirm: value,
              }));
            }}
          />
        </ListItem>
        <ListItem
          mx="$0"
          p="$0"
          hoverStyle={null}
          pressStyle={null}
          cursor="pointer"
          title={intl.formatMessage({
            id: ETranslations.perp_setting_interface,
          })}
          subtitle={interfaceTypeLabel}
          onPress={() => {
            setCurrentPage(EPerpSettingsPage.InterfaceSelection);
          }}
        >
          <Icon name="ChevronRightOutline" color="$iconSubdued" size="$5" />
        </ListItem>
      </YStack>
    );
  }

  // Interface selection page
  return (
    <YStack gap="$4">
      <XStack
        alignItems="center"
        gap="$2"
        py="$2"
        onPress={() => {
          setCurrentPage(EPerpSettingsPage.Main);
        }}
        cursor="pointer"
      >
        <IconButton
          icon="ChevronLeftOutline"
          variant="tertiary"
          size="small"
          hoverStyle={null}
          pressStyle={null}
        />
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          hoverStyle={{ color: '$text', size: '$bodyMdMedium' }}
          pressStyle={{ color: '$text', size: '$bodyMdMedium' }}
          flex={1}
        >
          {intl.formatMessage({
            id: ETranslations.perp_setting_interface,
          })}
        </SizableText>
      </XStack>
      <YStack>
        <Radio
          value={perpUserConfig.currentUserType}
          onChange={(value) => {
            void setPerpUserConfig(value as EPerpUserType);
          }}
          gap="$2"
          options={[
            {
              label: intl.formatMessage({
                id: ETranslations.perp_setting_interface_native_title,
              }),
              value: EPerpUserType.PERP_NATIVE,
              description: intl.formatMessage({
                id: ETranslations.perp_setting_interface_native_desc,
              }),
            },
            {
              label: intl.formatMessage({
                id: ETranslations.perp_setting_interface_web_title,
              }),
              value: EPerpUserType.PERP_WEB,
              description: intl.formatMessage({
                id: ETranslations.perp_setting_interface_web_desc,
              }),
            },
          ]}
        />
      </YStack>
    </YStack>
  );
}

function PerpSettingsDialogWrapper({ close }: { close: () => void }) {
  const [currentPage, setCurrentPage] = useState<EPerpSettingsPage>(
    EPerpSettingsPage.Main,
  );

  return (
    <PerpSettingsDialogContent
      close={close}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
    />
  );
}

export function showPerpSettingsDialog() {
  const dialog = Dialog.show({
    title: appLocale.intl.formatMessage({ id: ETranslations.global_settings }),
    renderContent: (
      <PerpsProviderMirror>
        <PerpSettingsDialogWrapper
          close={() => {
            void dialog.close();
          }}
        />
      </PerpsProviderMirror>
    ),
    showFooter: true,
    showCancelButton: false,
    onConfirmText: appLocale.intl.formatMessage({
      id: ETranslations.global_confirm,
    }),
  });

  return dialog;
}
