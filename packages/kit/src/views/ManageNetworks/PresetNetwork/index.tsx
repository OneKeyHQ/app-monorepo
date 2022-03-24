import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useNavigation } from '@react-navigation/core';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Form,
  KeyboardDismissView,
  Modal,
  Spinner,
  Typography,
  useForm,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useToast } from '../../../hooks';
import { ManageNetworkRoutes, ManageNetworkRoutesParams } from '../types';

import { DiscardAlert } from './DiscardAlert';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.PresetNetwork
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
  ManageNetworkRoutes.PresetNetwork
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

async function measure(url: string, impl = 'evm'): Promise<number> {
  const { responseTime } =
    await backgroundApiProxy.serviceNetwork.getRPCEndpointStatus(url, impl);
  return responseTime;
}

export const PresetNetwork: FC<PresetNetwokProps> = ({ route }) => {
  const { name, rpcURL, chainId, symbol, exploreUrl, id, impl } = route.params;
  const intl = useIntl();
  const [visible, setVisible] = useState(false);
  const refData = useRef({ preventRemove: false });
  const navigation = useNavigation<NavigationProps>();
  const { info } = useToast();
  const [rpcUrls, setRpcUrls] = useState<string[]>([]);
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

  const watchedRpcURL = watch('rpcURL');

  const onButtonPress = useCallback(() => {
    setResetOpened(true);
  }, []);

  useEffect(() => {
    serviceNetwork.getPresetRpcEndpoints(id).then((urls: string[]) => {
      setRpcUrls(urls);
    });
  }, [serviceNetwork, id]);

  const onSubmit = useCallback(
    async (data: NetworkValues) => {
      await serviceNetwork.updateNetwork(id, { rpcURL: data.rpcURL });
      info(intl.formatMessage({ id: 'msg__change_saved' }));
      refData.current.preventRemove = true;
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    },
    [serviceNetwork, id, info, intl, navigation, refData],
  );

  useEffect(() => {
    rpcUrls.forEach((url) => {
      measure(url, impl).then((value) =>
        setNetworkStatus((prev) => ({ ...prev, [url]: value })),
      );
    });
  }, [rpcUrls, impl]);

  const options = useMemo<
    { value: string; label: string; trailing?: React.ReactNode }[]
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
    reset(route.params);
    setResetOpened(false);
    info(intl.formatMessage({ id: 'msg__network_reset' }));
    navigation.popToTop();
  }, [route.params, info, intl, reset, navigation]);

  const onBeforeRemove = useCallback(
    (e) => {
      if (getValues('rpcURL') !== rpcURL && !refData.current.preventRemove) {
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

  return (
    <>
      <Modal
        header={name}
        height="560px"
        primaryActionProps={{
          onPromise: handleSubmit(onSubmit),
          isDisabled: watchedRpcURL === rpcURL,
        }}
        primaryActionTranslationId="action__save"
        hideSecondaryAction
        scrollViewProps={{
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
                  <Form.Input isDisabled />
                </Form.Item>
                <Form.Item
                  name="rpcURL"
                  control={control}
                  label={intl.formatMessage({
                    id: 'form__rpc_url',
                    defaultMessage: 'RPC URL',
                  })}
                  formControlProps={{ zIndex: 10 }}
                  helpText={
                    watchedRpcURL && networkStatus[watchedRpcURL]
                      ? intl.formatMessage(
                          { id: 'form__rpc_url_spped' },
                          { value: networkStatus[watchedRpcURL] },
                        )
                      : intl.formatMessage({ id: 'form__rpc_url_connecting' })
                  }
                >
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
                  />
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
                  <Form.Input placeholder="ETH" isDisabled />
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
                  <Form.Input isDisabled />
                </Form.Item>
                <Button
                  w="full"
                  size="lg"
                  onPress={onButtonPress}
                  isDisabled={watchedRpcURL === rpcURL}
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
