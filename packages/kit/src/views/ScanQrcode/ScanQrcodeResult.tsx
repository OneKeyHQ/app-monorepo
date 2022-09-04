import React, { FC, useCallback } from 'react';

import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  HStack,
  Icon,
  Modal,
  Pressable,
  Typography,
  useSafeAreaInsets,
  useToast,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { UserInputCategory } from '@onekeyhq/engine/src/types/credential';
import { CreateWalletModalRoutes } from '@onekeyhq/kit/src/routes';

import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { TabRoutes } from '../../routes/types';
import { AddressBookRoutes } from '../AddressBook/routes';

import {
  ScanQrcodeRoutes,
  ScanQrcodeRoutesParams,
  ScanSubResultCategory,
} from './types';

const pressableProps = {
  p: '4',
  bg: 'surface-default',
  borderRadius: '12px',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  shadow: 'depth.2',
} as const;

function CopyButton({ data }: { data: string }) {
  const intl = useIntl();
  const toast = useToast();
  const onPress = useCallback(() => {
    copyToClipboard(data);
    toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
  }, [data, intl, toast]);
  return (
    <Pressable {...pressableProps} onPress={onPress}>
      <HStack space="4">
        <Icon name="DuplicateOutline" />
        <Typography.Body1>
          {intl.formatMessage({
            id: 'action__copy',
          })}
        </Typography.Body1>
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
  const route = useRoute<ScanQrcodeResultRouteProp>();
  const { type, data, possibleNetworks } = route.params;
  let header = intl.formatMessage({ id: 'title__qr_code_info' });
  if (type === ScanSubResultCategory.URL) {
    header = intl.formatMessage({ id: 'title__url' });
  } else if (
    type === UserInputCategory.WATCHING ||
    type === UserInputCategory.ADDRESS
  ) {
    header = intl.formatMessage({ id: 'form__address' });
  }
  const actions = (
    <>
      {type === ScanSubResultCategory.URL && (
        <>
          <Pressable
            {...pressableProps}
            mb="16px"
            onPress={() => {
              navigation
                .getParent()
                ?.navigate(TabRoutes.Discover, { incomingUrl: data });
            }}
          >
            <HStack space="4">
              <Icon name="CompassOutline" />
              <Typography.Body1>
                {intl.formatMessage({
                  id: 'form__view_in_explore',
                })}
              </Typography.Body1>
            </HStack>
            <Icon name="ChevronRightSolid" size={20} />
          </Pressable>
          <Divider />
        </>
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
                  possibleNetworks,
                },
              );
            }}
          >
            <HStack space="4">
              <Icon name="ArrowUpOutline" />
              <Typography.Body1>
                {intl.formatMessage({
                  id: 'form__send_tokens',
                })}
              </Typography.Body1>
            </HStack>
            <Icon name="ChevronRightSolid" size={20} />
          </Pressable>
          <Divider />
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
                    possibleNetworks,
                  },
                },
              });
            }}
          >
            <HStack space="4">
              <Icon name="PlusSolid" />
              <Typography.Body1>
                {intl.formatMessage({
                  id: 'form__add_to_address_book',
                })}
              </Typography.Body1>
            </HStack>
            <Icon name="ChevronRightSolid" size={20} />
          </Pressable>
          <Divider />
        </>
      )}
      {(type === UserInputCategory.WATCHING ||
        type === UserInputCategory.MNEMONIC ||
        type === UserInputCategory.IMPORTED) && (
        <>
          <Pressable
            {...pressableProps}
            borderTopRadius={0}
            mb="16px"
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
            <HStack space="4">
              <Icon name="ImportOutline" />
              <Typography.Body1>
                {intl.formatMessage({
                  id: 'form__imported_as_a_watch_account',
                })}
              </Typography.Body1>
            </HStack>
            <Icon name="ChevronRightSolid" size={20} />
          </Pressable>
          <Divider />
        </>
      )}
      <CopyButton data={data} />
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
              borderWidth="1px"
              borderRadius="12px"
              borderStyle="dashed"
              alignItems="center"
              justifyContent="center"
              // flexWrap="nowrap"
              p="20px"
              mb="32px"
            >
              <Typography.Body2 textAlign="center" wordBreak="break-all">
                {data}
              </Typography.Body2>
            </Box>
            {actions}
          </>
        ),
      }}
    />
  );
};

export default ScanQrcodeResult;
