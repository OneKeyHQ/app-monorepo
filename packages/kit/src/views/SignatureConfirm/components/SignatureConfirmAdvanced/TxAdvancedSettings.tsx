import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isNaN, isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Accordion,
  Button,
  Dialog,
  Form,
  Icon,
  Input,
  SizableText,
  YStack,
  useForm,
} from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useDecodedTxsAtom,
  useSendSelectedFeeInfoAtom,
  useSignatureConfirmActions,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { TxDataViewer } from '../SignatureConfirmDataViewer';

type IProps = {
  accountId: string;
  networkId: string;
};

const showNonceFaq = () => {
  Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_nonce,
    }),
    icon: 'LabOutline',
    description: appLocale.intl.formatMessage({
      id: ETranslations.global_nonce_faq_desc,
    }),
    showCancelButton: false,
    onConfirmText: appLocale.intl.formatMessage({
      id: ETranslations.global_ok,
    }),
  });
};

const showHexDataFaq = () => {
  Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_hex_data_default,
    }),
    icon: 'ConsoleOutline',
    description: appLocale.intl.formatMessage({
      id: ETranslations.global_hex_data_faq_desc,
    }),
    showCancelButton: false,
    onConfirmText: appLocale.intl.formatMessage({
      id: ETranslations.global_ok,
    }),
  });
};

function TxAdvancedSettings(props: IProps) {
  const { accountId, networkId } = props;
  const intl = useIntl();
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [{ decodedTxs }] = useDecodedTxsAtom();
  const [settings] = useSettingsPersistAtom();
  const { updateTxAdvancedSettings } = useSignatureConfirmActions().current;
  const [selectedFee] = useSendSelectedFeeInfoAtom();
  const vaultSettings = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
    [networkId],
  ).result;

  const isInternalSwapTx = useMemo(
    () => unsignedTxs.length === 1 && unsignedTxs[0].swapInfo,
    [unsignedTxs],
  );

  const isInternalStakingTx = useMemo(
    () => unsignedTxs.length === 1 && unsignedTxs[0].stakingInfo,
    [unsignedTxs],
  );

  const { result: txContent } = usePromiseResult(async () => {
    if (!unsignedTxs || unsignedTxs.length === 0) {
      return '';
    }

    let txString = '';

    for (let i = 0; i < unsignedTxs.length; i += 1) {
      const unsignedTx = unsignedTxs[i];
      const unsignedTxWithFeeInfo =
        await backgroundApiProxy.serviceSend.updateUnsignedTx({
          unsignedTx,
          feeInfo: selectedFee?.feeInfos[i]?.feeInfo,
          networkId,
          accountId,
        });

      const encodedTx = unsignedTxWithFeeInfo.encodedTx as IEncodedTxEvm;

      if (!isNil(encodedTx.nonce)) {
        encodedTx.nonce = hexUtils.hexlify(encodedTx.nonce);
      }

      try {
        const tx = JSON.stringify(encodedTx, null, 2);
        txString = txString ? `${txString}\n\n${tx}` : tx;
      } catch {
        // ignore
      }
    }

    return txString;
  }, [unsignedTxs, selectedFee?.feeInfos, accountId, networkId]);

  const abiContent = useMemo(() => {
    if (!decodedTxs || decodedTxs.length === 0) {
      return '';
    }
    return decodedTxs.reduce((acc, decodedTx) => {
      try {
        const txABI = JSON.stringify(decodedTx.txABI, null, 2);
        return acc ? `${acc}\n\n${txABI}` : txABI;
      } catch {
        return acc;
      }
    }, '');
  }, [decodedTxs]);

  const hexContent = useMemo(() => {
    if (!unsignedTxs || unsignedTxs.length === 0) {
      return '';
    }
    return unsignedTxs.reduce((acc, unsignedTx) => {
      const tx = unsignedTx.encodedTx as IEncodedTxEvm;
      if (tx && tx.data) {
        return acc ? `${acc}\n\n${tx.data}` : tx.data;
      }
      return acc;
    }, '');
  }, [unsignedTxs]);

  const canEditNonce = useMemo(
    () =>
      !isInternalStakingTx &&
      !isInternalSwapTx &&
      unsignedTxs.length === 1 &&
      !unsignedTxs[0]?.isInternalSwap &&
      vaultSettings?.canEditNonce &&
      settings.isCustomNonceEnabled &&
      !isNil(unsignedTxs[0]?.nonce),
    [
      isInternalStakingTx,
      isInternalSwapTx,
      settings.isCustomNonceEnabled,
      unsignedTxs,
      vaultSettings?.canEditNonce,
    ],
  );

  const currentNonce = new BigNumber(unsignedTxs[0]?.nonce ?? 0).toFixed();

  const form = useForm({
    defaultValues: {
      nonce: currentNonce,
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  const handleValidateNonce = useCallback(
    async (value: string) => {
      if (value === '') {
        return true;
      }

      const nonceBN = new BigNumber(value ?? 0);
      if (nonceBN.isLessThan(currentNonce)) {
        return intl.formatMessage({
          id: ETranslations.global_nonce_error_lower,
        });
      }

      const pendingTxsNonceList =
        await backgroundApiProxy.serviceHistory.getAccountLocalPendingTxsNonceList(
          {
            accountId,
            networkId,
          },
        );

      if (pendingTxsNonceList.includes(nonceBN.toNumber())) {
        return intl.formatMessage({
          id: ETranslations.global_nonce_error_lower,
        });
      }

      if (nonceBN.isGreaterThan(currentNonce)) {
        return intl.formatMessage({
          id: ETranslations.global_nonce_error_higher,
        });
      }

      return true;
    },
    [accountId, currentNonce, intl, networkId],
  );

  const renderAdvancedSettings = useCallback(
    () => (
      <YStack gap="$5">
        {canEditNonce ? (
          <Form form={form}>
            <Form.Field
              label={intl.formatMessage({
                id: ETranslations.global_nonce,
              })}
              name="nonce"
              rules={{
                validate: handleValidateNonce,
                onChange: (e: { target: { name: string; value: string } }) => {
                  const value = e.target?.value;
                  let finalValue = '';

                  if (value === '') {
                    finalValue = '';
                  } else {
                    const formattedValue = Number.parseInt(value, 10);

                    if (isNaN(formattedValue)) {
                      form.setValue('nonce', '');
                      finalValue = '';
                    } else {
                      form.setValue('nonce', String(formattedValue));
                      finalValue = String(formattedValue);
                    }
                  }

                  updateTxAdvancedSettings({
                    nonce: finalValue,
                  });
                },
              }}
              description={intl.formatMessage(
                {
                  id: ETranslations.global_nonce_desc,
                },
                {
                  'amount': currentNonce,
                },
              )}
              labelAddon={
                <Button
                  size="small"
                  variant="tertiary"
                  onPress={() => showNonceFaq()}
                >
                  {intl.formatMessage({
                    id: ETranslations.global_nonce_faq,
                  })}
                </Button>
              }
            >
              <Input flex={1} placeholder={currentNonce} />
            </Form.Field>
          </Form>
        ) : null}

        <TxDataViewer
          dataGroup={[
            { title: 'DATA', data: txContent ?? '' },
            { title: 'ABI', data: abiContent },
            { title: 'HEX', data: hexContent },
          ]}
          showCopy
        />
      </YStack>
    ),
    [
      abiContent,
      canEditNonce,
      currentNonce,
      form,
      handleValidateNonce,
      hexContent,
      intl,
      txContent,
      updateTxAdvancedSettings,
    ],
  );

  if (!canEditNonce && !vaultSettings?.canEditData) {
    return null;
  }

  return (
    <>
      <YStack
        pt="$5"
        borderTopWidth={StyleSheet.hairlineWidth}
        borderTopColor="$borderSubdued"
      >
        <Accordion type="multiple" collapsable>
          <Accordion.Item value="advance">
            <Accordion.Trigger
              unstyled
              flexDirection="row"
              alignItems="center"
              alignSelf="flex-start"
              px="$1"
              mx="$-1"
              borderWidth={0}
              bg="$transparent"
              userSelect="none"
              borderRadius="$1"
              hoverStyle={{
                bg: '$bgSubdued',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusVisibleStyle={{
                outlineColor: '$focusRing',
                outlineWidth: 2,
                outlineStyle: 'solid',
                outlineOffset: 0,
              }}
            >
              {({ open }: { open: boolean }) => (
                <>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.global_advanced_settings,
                    })}
                  </SizableText>
                  <YStack animation="quick" rotate={open ? '180deg' : '0deg'}>
                    <Icon
                      name="ChevronDownSmallOutline"
                      color="$iconSubdued"
                      size="$5"
                    />
                  </YStack>
                </>
              )}
            </Accordion.Trigger>
            <Accordion.HeightAnimator animation="quick">
              <Accordion.Content
                unstyled
                animation="quick"
                enterStyle={{ opacity: 0 }}
                exitStyle={{ opacity: 0 }}
                pt="$5"
              >
                {renderAdvancedSettings()}
              </Accordion.Content>
            </Accordion.HeightAnimator>
          </Accordion.Item>
        </Accordion>
      </YStack>
    </>
  );
}

export { TxAdvancedSettings };
