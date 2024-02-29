import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  ActionList,
  Dialog,
  Form,
  Input,
  Stack,
  TextArea,
  XStack,
  useClipboard,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { NetworkSelectorTriggerLegacy } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { openUrlExternal } from '@onekeyhq/kit/src/utils/openUrl';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { buildExplorerAddressUrl } from '@onekeyhq/shared/src/utils/uriUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IToken } from '@onekeyhq/shared/types/token';

import { EAssetSelectorRoutes } from '../../../AssetSelector/router/types';
import { EModalReceiveRoutes } from '../../../Receive/router/type';
import {
  EModalSendRoutes,
  type IModalSendParamList,
} from '../../../Send/router';

import { WalletActionItems } from './WalletActionItem';

function WalletActionBuy() {
  return (
    <WalletActionItems label="Buy" onPress={() => {}} icon="PlusLargeOutline" />
  );
}

function WalletActionSend() {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();

  const handleOnSend = useCallback(async () => {
    if (!account || !network) return;
    navigation.pushModal(EModalRoutes.AssetSelectorModal, {
      screen: EAssetSelectorRoutes.TokenSelector,
      params: {
        networkId: network.id,
        accountId: account.id,
        networkName: network.name,
        tokens: {
          data: allTokens.tokens,
          keys: allTokens.keys,
          map,
        },
        onSelect: async (token: IToken) => {
          await timerUtils.wait(600);
          navigation.pushModal(EModalRoutes.SendModal, {
            screen: EModalSendRoutes.SendDataInput,
            params: {
              accountId: account.id,
              networkId: network.id,
              isNFT: false,
              token,
            },
          });
        },
      },
    });
  }, [account, allTokens.keys, allTokens.tokens, map, navigation, network]);

  return (
    <WalletActionItems
      label="Send"
      onPress={handleOnSend}
      icon="ArrowTopOutline"
    />
  );
}

function WalletActionReceive() {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const form = useForm();

  const handleOnReceive = useCallback(() => {
    Dialog.confirm({
      title: 'Lighting Invoice',
      renderContent: (
        <Stack>
          <Form form={form}>
            <AccountSelectorProviderMirror
              config={{
                sceneName: EAccountSelectorSceneName.discover,
                sceneUrl: 'https://www.bing.com',
              }}
              enabledNum={[1]}
            >
              <NetworkSelectorTriggerLegacy key={1} num={1} />
            </AccountSelectorProviderMirror>

            <AccountSelectorProviderMirror
              config={{
                sceneName: EAccountSelectorSceneName.discover,
                sceneUrl: 'https://www.bing.com',
              }}
              enabledNum={[0]}
            >
              <NetworkSelectorTriggerLegacy key={0} num={0} />
            </AccountSelectorProviderMirror>

            <AccountSelectorProviderMirror
              config={{
                sceneName: EAccountSelectorSceneName.home,
              }}
              enabledNum={[1]}
            />
            <Form.Field label="Amount" name="amount" description="$0.00">
              <Input
                placeholder="Enter amount"
                size="large"
                keyboardType="number-pad"
                addOns={[
                  {
                    label: 'sats',
                  },
                ]}
              />
            </Form.Field>
            <Form.Field
              label="Description"
              description="Enter a brief description for the payment. This helps the recipient identify and record the transaction."
              name="description"
              optional
            >
              <TextArea
                size="large"
                placeholder="e.g., Coffee purchase, Invoice #12345"
              />
            </Form.Field>
          </Form>
        </Stack>
      ),
      onConfirm: async ({ close }) => {
        await close();
        navigation.pushModal(EModalRoutes.ReceiveModal, {
          screen: EModalReceiveRoutes.LightingInvoice,
        });
      },
    });
  }, [form, navigation]);

  return (
    <WalletActionItems
      label="Receive"
      onPress={handleOnReceive}
      icon="ArrowBottomOutline"
    />
  );
}

function WalletActionSwap() {
  const handleOnSwap = useCallback(() => {}, []);
  return (
    <WalletActionItems
      label="Swap"
      onPress={handleOnSwap}
      icon="SwitchHorOutline"
    />
  );
}

function WalletActionMore() {
  const media = useMedia();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const intl = useIntl();
  const { copyText } = useClipboard();

  return (
    <ActionList
      title={intl.formatMessage({ id: 'action__more' })}
      renderTrigger={
        <WalletActionItems
          icon="DotHorOutline"
          {...(media.sm && {
            label: intl.formatMessage({ id: 'action__more' }),
          })}
        />
      }
      sections={[
        {
          items: [
            {
              label: intl.formatMessage({ id: 'action__sell_crypto' }),
              icon: 'MinusLargeOutline',
              onPress: () => {},
            },
          ],
        },
        {
          items: [
            {
              label: intl.formatMessage({ id: 'action__view_in_explorer' }),
              icon: 'GlobusOutline',
              onPress: () =>
                openUrlExternal(
                  buildExplorerAddressUrl({
                    network,
                    address: account?.address,
                  }),
                ),
            },
            {
              label: intl.formatMessage({ id: 'action__copy_address' }),
              icon: 'Copy1Outline',
              onPress: () => copyText(account?.address || ''),
            },
          ],
        },
      ]}
    />
  );
}

function WalletActions() {
  return (
    <XStack
      justifyContent="space-between"
      $gtSm={{
        justifyContent: 'unset',
        space: '$2',
      }}
    >
      <WalletActionSend />
      <WalletActionReceive />
      <WalletActionBuy />
      <WalletActionSwap />
      <WalletActionMore />
    </XStack>
  );
}

export { WalletActions };
