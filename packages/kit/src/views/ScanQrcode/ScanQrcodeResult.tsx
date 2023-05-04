import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  HStack,
  Icon,
  Modal,
  Pressable,
  ToastManager,
  Typography,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { UserInputCategory } from '@onekeyhq/engine/src/types/credential';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { CreateWalletModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { TabRoutes } from '../../routes/types';
import { setIncomingUrl } from '../../store/reducers/webTabs';
import { AddressBookRoutes } from '../AddressBook/routes';

import { ScanQrcodeRoutes, ScanSubResultCategory } from './types';

import type { ScanQrcodeRoutesParams } from './types';
import type { NavigationProp, RouteProp } from '@react-navigation/core';

const WrapperProps = {
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'border-subdued',
  bgColor: 'surface-default',
  mb: '16px',
  borderRadius: '12px',
  overflow: 'hidden',
} as const;

const pressableProps = {
  p: '4',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  _hover: { bgColor: 'surface-hovered' },
  _pressed: { bgColor: 'surface-pressed' },
} as const;

function CopyButton({ data }: { data: string }) {
  const intl = useIntl();

  const onPress = useCallback(() => {
    copyToClipboard(data);
    ToastManager.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
  }, [data, intl]);
  return (
    <Pressable {...pressableProps} onPress={onPress}>
      <HStack space="3">
        <Icon name="Square2StackOutline" />
        <Typography.Body1Strong>
          {intl.formatMessage({
            id: 'action__copy',
          })}
        </Typography.Body1Strong>
      </HStack>
    </Pressable>
  );
}
type ScanQrcodeResultRouteProp = RouteProp<
  ScanQrcodeRoutesParams,
  ScanQrcodeRoutes.ScanQrcodeResult
>;
type PreviewSendNavProp = NavigationProp<
  ScanQrcodeRoutesParams,
  ScanQrcodeRoutes.PreviewSend
>;
const ScanQrcodeResult: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { bottom } = useSafeAreaInsets();
  const { wallet } = useActiveWalletAccount();
  const route = useRoute<ScanQrcodeResultRouteProp>();
  const { type: initialType, data } = route.params;
  // TODO multiple types
  const [type, setType] = useState(initialType);
  const possibleNetworks = useRef<string[]>();

  useEffect(() => {
    if (initialType === ScanSubResultCategory.TEXT) {
      backgroundApiProxy.validator
        .validateCreateInput({
          input: data,
          returnEarly: true,
        })
        .then(([result]) => {
          if (result) {
            setType(result.category);
            possibleNetworks.current = result.possibleNetworks;
          }
        })
        .catch((e) => {
          debugLogger.backgroundApi.error(e);
        });
    }
  }, [data, initialType]);

  let header = intl.formatMessage({ id: 'title__qr_code_info' });
  if (type === ScanSubResultCategory.URL) {
    header = intl.formatMessage({ id: 'title__url' });
  } else if (
    type === UserInputCategory.WATCHING ||
    type === UserInputCategory.ADDRESS
  ) {
    header = intl.formatMessage({ id: 'form__address' });
  }
  const sendDisabled = wallet?.type === 'watching';
  const actions = (
    <>
      <Box {...WrapperProps}>
        {type === ScanSubResultCategory.URL && (
          <Pressable
            {...pressableProps}
            onPress={() => {
              backgroundApiProxy.dispatch(setIncomingUrl(data));
              navigation.getParent()?.navigate(TabRoutes.Discover);
            }}
          >
            <HStack space="3">
              <Icon name="GlobeAltOutline" />
              <Typography.Body1Strong>
                {intl.formatMessage({
                  id: 'form__view_in_explore',
                })}
              </Typography.Body1Strong>
            </HStack>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Pressable>
        )}
        {(type === UserInputCategory.WATCHING ||
          type === UserInputCategory.ADDRESS) && (
          <>
            <Pressable
              {...pressableProps}
              borderBottomRadius={0}
              onPress={() => {
                (navigation as any as PreviewSendNavProp).navigate(
                  ScanQrcodeRoutes.PreviewSend,
                  {
                    address: data,
                    possibleNetworks: possibleNetworks.current,
                  },
                );
              }}
              isDisabled={sendDisabled}
            >
              <HStack space="3">
                <Icon
                  name="PaperAirplaneOutline"
                  color={sendDisabled ? 'icon-disabled' : 'icon-default'}
                />
                <Typography.Body1Strong
                  color={sendDisabled ? 'text-disabled' : 'text-default'}
                >
                  {intl.formatMessage({
                    id: 'form__send_tokens',
                  })}
                </Typography.Body1Strong>
              </HStack>
              <Icon
                name="ChevronRightMini"
                size={20}
                color={sendDisabled ? 'icon-disabled' : 'icon-subdued'}
              />
            </Pressable>
            <Box h={StyleSheet.hairlineWidth} bgColor="divider" />
            <Pressable
              {...pressableProps}
              borderRadius={0}
              onPress={() => {
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.AddressBook,
                  params: {
                    screen: AddressBookRoutes.NewAddressRoute,
                    params: {
                      address: data,
                      possibleNetworks: possibleNetworks.current,
                    },
                  },
                });
              }}
            >
              <HStack space="3">
                <Icon name="BookOpenOutline" />
                <Typography.Body1Strong>
                  {intl.formatMessage({
                    id: 'form__add_to_address_book',
                  })}
                </Typography.Body1Strong>
              </HStack>
              <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
            </Pressable>
            <Box h={StyleSheet.hairlineWidth} bgColor="divider" />
          </>
        )}
        {(type === UserInputCategory.WATCHING ||
          type === UserInputCategory.MNEMONIC ||
          type === UserInputCategory.IMPORTED) && (
          <Pressable
            {...pressableProps}
            borderTopRadius={0}
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.CreateWallet,
                params: {
                  screen: CreateWalletModalRoutes.AddExistingWalletModal,
                  params: {
                    mode: type,
                    presetText: data,
                  },
                },
              });
            }}
          >
            <HStack space="3">
              <Icon name="EyeOutline" />
              <Typography.Body1Strong textTransform="capitalize">
                {intl.formatMessage({
                  id: 'action__watch_lowercase',
                })}
              </Typography.Body1Strong>
            </HStack>
            <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
          </Pressable>
        )}
      </Box>
      <Box {...WrapperProps}>
        <CopyButton data={data} />
      </Box>
    </>
  );
  return (
    <Modal
      hidePrimaryAction
      hideSecondaryAction
      header={header}
      footer={null}
      scrollViewProps={{
        pb: `${bottom}px`,
        children: (
          <>
            <Box
              borderColor="border-subdued"
              borderWidth={StyleSheet.hairlineWidth}
              bgColor="surface-subdued"
              borderRadius="12px"
              alignItems="center"
              justifyContent="center"
              // flexWrap="nowrap"
              p="24px"
              mb="32px"
            >
              <Typography.Body1 textAlign="center" wordBreak="break-all">
                {data}
              </Typography.Body1>
            </Box>
            {actions}
          </>
        ),
      }}
    />
  );
};

export default ScanQrcodeResult;
