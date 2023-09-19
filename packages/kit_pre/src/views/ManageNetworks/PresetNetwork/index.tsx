import type { FC, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Form,
  KeyboardDismissView,
  Modal,
  Spinner,
  Switch,
  ToastManager,
  Typography,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDebounce } from '../../../hooks';
import { URITester } from '../CustomNetwork';

import { DiscardAlert } from './DiscardAlert';

import type { NetworkRpcURLStatus } from '../CustomNetwork';
import type {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from '../types';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.PresetNetwork
>;

type NetworkValues = {
  name?: string;
  rpcURL?: string;
  chainId?: string;
  symbol?: string;
  exploreUrl?: string;
  id: string;
};

type PresetNetwokProps = NativeStackScreenProps<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.PresetNetwork
>;

function getColor(value: number) {
  if (value <= 300) {
    return 'text-success';
  }
  if (value <= 1000) {
    return 'text-warning';
  }
  return 'text-critical';
}

async function measure(
  url: string,
  networkId: string = OnekeyNetwork.eth,
): Promise<number> {
  const { responseTime } =
    await backgroundApiProxy.serviceNetwork.getRPCEndpointStatus(
      url,
      networkId,
    );
  return responseTime;
}

export const PresetNetwork: FC<PresetNetwokProps> = ({ route }) => {
  const { name, rpcURL, chainId, symbol, exploreUrl, id, impl } = route.params;
  const intl = useIntl();
  const [visible, setVisible] = useState(false);
  const refData = useRef({ preventRemove: false, isResetting: false });
  const navigation = useNavigation<NavigationProps>();

  const [rpcUrls, setRpcUrls] = useState<string[]>([]);
  const [defaultRpcURL, setDefaultRpcURL] = useState<string>(rpcURL ?? '');
  const [networkStatus, setNetworkStatus] = useState<Record<string, number>>(
    {},
  );
  const { serviceNetwork } = backgroundApiProxy;
  const { control, handleSubmit, reset, watch, getValues } =
    useForm<NetworkValues>({
      mode: 'onChange',
      defaultValues: { name, rpcURL, chainId, symbol, exploreUrl, id },
    });
  const [resetOpened, setResetOpened] = useState(false);
  const isSmallScreen = useIsVerticalLayout();

  const watchedRpcURL = useDebounce(watch('rpcURL'), 1000);

  const onButtonPress = useCallback(() => {
    setResetOpened(true);
  }, []);

  useEffect(() => {
    serviceNetwork
      .getPresetRpcEndpoints(id)
      .then(
        ({
          urls,
          defaultRpcURL: defaultURL,
        }: {
          urls: Array<string>;
          defaultRpcURL: string;
        }) => {
          setRpcUrls(urls);
          setDefaultRpcURL(defaultURL);
        },
      );
  }, [serviceNetwork, id]);

  const onSubmit = useCallback(
    async (data: NetworkValues) => {
      await serviceNetwork.updateNetwork(id, { rpcURL: data.rpcURL });
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__change_saved' }),
      });
      refData.current.preventRemove = true;
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
      }
    },
    [serviceNetwork, id, intl, navigation, refData],
  );

  useEffect(() => {
    rpcUrls.forEach((url) => {
      measure(url, id).then(
        (value) => setNetworkStatus((prev) => ({ ...prev, [url]: value })),
        (error) => {
          console.error(error);
        },
      );
    });
  }, [rpcUrls, id]);

  const options = useMemo<
    { value: string; label: string; trailing?: ReactNode }[]
  >(
    () =>
      rpcUrls.map((url) => ({
        value: url,
        label: url,
        trailing: networkStatus[url] ? (
          <Typography.Body2Strong color={getColor(networkStatus[url])}>
            {networkStatus[url]}ms
          </Typography.Body2Strong>
        ) : (
          <Spinner size="sm" />
        ),
      })),
    [rpcUrls, networkStatus],
  );

  const onReset = useCallback(() => {
    refData.current.isResetting = true;
    reset({ ...route.params, rpcURL: defaultRpcURL });
    setResetOpened(false);
    ToastManager.show({
      title: intl.formatMessage({ id: 'msg__network_reset' }),
    });
    navigation.popToTop();
  }, [route.params, intl, reset, navigation, defaultRpcURL, refData]);

  const onBeforeRemove = useCallback(
    (e) => {
      if (refData.current.isResetting && !refData.current.preventRemove) {
        refData.current.isResetting = false;
        // eslint-disable-next-line
        e.preventDefault();
      } else if (
        getValues('rpcURL') !== rpcURL &&
        !refData.current.preventRemove
      ) {
        // eslint-disable-next-line
        e.preventDefault();
        setVisible(true);
      }
    },
    [refData, getValues, rpcURL],
  );

  const onDiscard = useCallback(() => {
    refData.current.preventRemove = true;
    setVisible(false);
    navigation.goBack();
  }, [navigation]);

  useEffect(() => {
    navigation.addListener('beforeRemove', onBeforeRemove);
    return () => {
      navigation.removeListener('beforeRemove', onBeforeRemove);
    };
  }, [onBeforeRemove, navigation]);

  const [isCustomRpc, setIsCustomRpc] = useState(false);
  const [rpcStatus, setRpcStatus] = useState<NetworkRpcURLStatus>({
    connected: false,
  });

  useEffect(() => {
    const url = watchedRpcURL?.trim() ?? '';
    if (!url) {
      setRpcStatus({ connected: false });
      return;
    }
    setRpcStatus({ connected: false, loading: true });
    if (rpcUrls.includes(url)) {
      // preset URLs
      if (networkStatus[url]) {
        // Already connected
        setRpcStatus({
          connected: true,
          loading: false,
          speed: networkStatus[url],
        });
      }
    } else if (URITester.test(url)) {
      // customized URL
      serviceNetwork
        .preAddNetwork(url)
        .then(({ chainId: pChainId }) => {
          if (pChainId !== chainId) {
            setRpcStatus({
              connected: false,
              loading: false,
              error: intl.formatMessage({ id: 'form__chain_id_invalid' }),
            });
          } else {
            measure(url, id).then((speed) =>
              setRpcStatus({ connected: true, loading: false, speed }),
            );
          }
        })
        .catch(() => {
          setRpcStatus({
            connected: false,
            loading: false,
            error: intl.formatMessage({ id: 'form__rpc_fetched_failed' }),
          });
        });
    }
  }, [
    watchedRpcURL,
    rpcUrls,
    networkStatus,
    serviceNetwork,
    chainId,
    intl,
    id,
  ]);

  const hintText = useMemo(() => {
    if (rpcStatus.error) return rpcStatus.error;
    if (rpcStatus.loading)
      return intl.formatMessage({ id: 'form__rpc_url_connecting' });
    if (rpcStatus.connected) {
      return intl.formatMessage(
        { id: 'form__rpc_url_spped' },
        { value: rpcStatus.speed },
      );
    }
  }, [rpcStatus, intl]);

  return (
    <>
      <Modal
        header={name}
        height="560px"
        primaryActionProps={{
          onPromise: handleSubmit(onSubmit),
          isDisabled: watchedRpcURL === rpcURL || !rpcStatus.connected,
        }}
        primaryActionTranslationId="action__save"
        hideSecondaryAction
        scrollViewProps={{
          showsVerticalScrollIndicator: false,
          children: (
            <KeyboardDismissView flexDirection="row" justifyContent="center">
              <Form>
                <Form.Item
                  name="name"
                  label={intl.formatMessage({
                    id: 'form__network_name',
                    defaultMessage: 'Network Name',
                  })}
                  control={control}
                >
                  <Form.Input
                    isDisabled
                    size={isSmallScreen ? 'xl' : 'default'}
                  />
                </Form.Item>
                <Form.Item
                  name="rpcURL"
                  control={control}
                  label={intl.formatMessage({
                    id: 'form__rpc_url',
                    defaultMessage: 'RPC URL',
                  })}
                  labelAddon={
                    <Switch
                      size="sm"
                      label={intl.formatMessage({ id: 'content__custom' })}
                      isChecked={isCustomRpc}
                      onToggle={() => setIsCustomRpc((v) => !v)}
                    />
                  }
                  formControlProps={{ zIndex: 10 }}
                  helpText={hintText}
                  rules={{
                    validate: () => rpcStatus.connected,
                  }}
                >
                  {isCustomRpc ? (
                    <Form.Input size={isSmallScreen ? 'xl' : 'default'} />
                  ) : (
                    <Form.Select
                      title={intl.formatMessage({
                        id: 'content__preset_rpc',
                        defaultMessage: 'Preset PRC URLs',
                      })}
                      footer={null}
                      containerProps={{
                        zIndex: 999,
                        padding: 0,
                      }}
                      options={options}
                      dropdownProps={{ width: '352px' }}
                      dropdownPosition="right"
                      triggerSize={isSmallScreen ? 'xl' : 'default'}
                    />
                  )}
                </Form.Item>
                {impl === 'evm' ? (
                  <Form.Item
                    name="chainId"
                    label={intl.formatMessage({
                      id: 'form__chain_id',
                      defaultMessage: 'Chain ID',
                    })}
                    control={control}
                  >
                    <Form.Input
                      placeholder={intl.formatMessage({ id: 'form__chain_id' })}
                      isDisabled
                      size={isSmallScreen ? 'xl' : 'default'}
                    />
                  </Form.Item>
                ) : null}
                <Form.Item
                  name="symbol"
                  label={intl.formatMessage({
                    id: 'form__symbol',
                    defaultMessage: 'Symbol',
                  })}
                  labelAddon={
                    <Typography.Body2 color="text-subdued">
                      {intl.formatMessage({
                        id: 'form__hint_optional',
                        defaultMessage: 'Optional',
                      })}
                    </Typography.Body2>
                  }
                  control={control}
                >
                  <Form.Input
                    placeholder="ETH"
                    isDisabled
                    size={isSmallScreen ? 'xl' : 'default'}
                  />
                </Form.Item>
                <Form.Item
                  name="exploreUrl"
                  label={intl.formatMessage({
                    id: 'form__blockchain_explorer_url',
                    defaultMessage: 'Blockchain Explore URL',
                  })}
                  labelAddon={
                    <Typography.Body2 color="text-subdued">
                      {intl.formatMessage({
                        id: 'form__hint_optional',
                        defaultMessage: 'Optional',
                      })}
                    </Typography.Body2>
                  }
                  control={control}
                >
                  <Form.Input
                    isDisabled
                    size={isSmallScreen ? 'xl' : 'default'}
                  />
                </Form.Item>
                <Button
                  w="full"
                  size={isSmallScreen ? 'xl' : 'lg'}
                  onPress={onButtonPress}
                  isDisabled={watchedRpcURL === defaultRpcURL}
                >
                  {intl.formatMessage({
                    id: 'action__reset',
                    defaultMessage: 'Reset',
                  })}
                </Button>
              </Form>
            </KeyboardDismissView>
          ),
        }}
      />
      <Dialog
        visible={resetOpened}
        contentProps={{
          iconType: 'info',
          title: intl.formatMessage({
            id: 'dialog__reset_network_title',
            defaultMessage: 'Reset Network',
          }),
          content: intl.formatMessage(
            {
              id: 'dialog__reset_network_desc',
              defaultMessage: '{0} will be revert to the default config',
            },
            { 0: name },
          ),
        }}
        footerButtonProps={{
          onPrimaryActionPress: onReset,
          primaryActionTranslationId: 'action__reset',
          primaryActionProps: {
            type: 'primary',
            size: 'lg',
          },
          secondaryActionProps: {
            size: 'lg',
          },
        }}
        onClose={() => setResetOpened(false)}
      />
      <DiscardAlert
        visible={visible}
        onConfirm={onDiscard}
        onClose={() => setVisible(false)}
      />
    </>
  );
};
