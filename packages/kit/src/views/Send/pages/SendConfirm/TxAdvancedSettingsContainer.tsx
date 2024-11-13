import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { utils } from 'ethers';
import { isNaN, isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import {
  Button,
  Dialog,
  Divider,
  Form,
  Input,
  TextAreaInput,
  useForm,
} from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useDecodedTxsAtom,
  useSendConfirmActions,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { checkIsEmptyData } from '@onekeyhq/kit-bg/src/vaults/impls/evm/decoder/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import {
  InfoItem,
  InfoItemGroup,
} from '../../../AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';

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
      id: ETranslations.global_done,
    }),
  });
};

const showHexDataFaq = () => {
  Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_hex_data,
    }),
    icon: 'ConsoleOutline',
    description: appLocale.intl.formatMessage({
      id: ETranslations.global_hex_data_faq_desc,
    }),
    showCancelButton: false,
    onConfirmText: appLocale.intl.formatMessage({
      id: ETranslations.global_done,
    }),
  });
};

function TxAdvancedSettingsContainer(props: IProps) {
  const { accountId, networkId } = props;
  const intl = useIntl();
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [decodedTxs] = useDecodedTxsAtom();
  const [settings] = useSettingsPersistAtom();
  const { updateTxAdvancedSettings, updateUnsignedTxs } =
    useSendConfirmActions().current;

  const [shouldShowSettings, setShouldShowSettings] = useState<boolean>(false);
  const [originalData, setOriginalData] = useState<string>('');

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

  const dataContent = useMemo(() => {
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
      unsignedTxs.length === 1 &&
      vaultSettings?.canEditNonce &&
      settings.isCustomNonceEnabled &&
      !isNil(unsignedTxs[0].nonce),
    [settings.isCustomNonceEnabled, unsignedTxs, vaultSettings?.canEditNonce],
  );

  const canEditData = useMemo(
    () => unsignedTxs.length === 1 && checkIsEmptyData(originalData),
    [unsignedTxs, originalData],
  );

  const currentNonce = new BigNumber(unsignedTxs[0].nonce ?? 0).toFixed();

  const form = useForm({
    defaultValues: {
      nonce: currentNonce,
      data: dataContent,
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  const shouldConvertHexDataToUtf8String = useMemo(
    () => decodedTxs.length === 1 && decodedTxs[0].isToContract === false,
    [decodedTxs],
  );

  const [hexDataUtf8String, setHexDataUtf8String] = useState<string>(
    hexUtils.hexStringToUtf8String(dataContent),
  );

  const handleValidateNonce = useCallback(
    async (value: string) => {
      setHexDataUtf8String('');
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
  const handleValidateData = useCallback(
    (value: string) => {
      setHexDataUtf8String('');
      if (checkIsEmptyData(value)) {
        return true;
      }

      if (
        !value.startsWith('0x') ||
        value.length % 2 !== 0 ||
        !utils.isHexString(value)
      ) {
        return intl.formatMessage({
          id: ETranslations.global_hex_data_error,
        });
      }

      return true;
    },
    [intl],
  );

  const handleDataOnChange = useDebouncedCallback(
    async (e: { target: { name: string; value: string } }) => {
      const value = e.target?.value;
      if (shouldConvertHexDataToUtf8String && utils.isHexString(value)) {
        try {
          const utf8String = hexUtils.hexStringToUtf8String(value);
          console.log('utf8String', utf8String);
          setHexDataUtf8String(utf8String);
        } catch (error) {
          console.log('error', error);
          setHexDataUtf8String('');
        }
      } else {
        setHexDataUtf8String('');
      }

      if (!form.getFieldState('data').invalid) {
        const newUnsignedTx =
          await backgroundApiProxy.serviceSend.updateUnsignedTx({
            accountId,
            networkId,
            unsignedTx: unsignedTxs[0],
            dataInfo: {
              data: value,
            },
          });
        updateTxAdvancedSettings({ dataChanged: true });
        updateUnsignedTxs([newUnsignedTx]);
      }
    },
    1000,
  );

  const renderAdvancedSettings = useCallback(
    () => (
      <Form form={form}>
        {canEditNonce ? (
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
                icon="WalletOutline"
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
        ) : null}
        <Form.Field
          label={intl.formatMessage({
            id: ETranslations.global_hex_data,
          })}
          name="data"
          rules={{
            validate: handleValidateData,
            onChange: handleDataOnChange,
          }}
          labelAddon={
            <Button
              size="small"
              variant="tertiary"
              icon="WalletOutline"
              onPress={() => showHexDataFaq()}
            >
              {intl.formatMessage({
                id: ETranslations.global_hex_data_faq,
              })}
            </Button>
          }
          description={
            shouldConvertHexDataToUtf8String &&
            !form.getFieldState('data').invalid
              ? hexDataUtf8String
              : ''
          }
        >
          <TextAreaInput editable={canEditData} flex={1} />
        </Form.Field>
      </Form>
    ),
    [
      canEditData,
      canEditNonce,
      currentNonce,
      form,
      handleDataOnChange,
      handleValidateData,
      handleValidateNonce,
      hexDataUtf8String,
      intl,
      shouldConvertHexDataToUtf8String,
      updateTxAdvancedSettings,
    ],
  );

  useEffect(() => {
    setOriginalData(dataContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (
    isInternalStakingTx ||
    isInternalSwapTx ||
    (!canEditNonce && !vaultSettings?.canEditData)
  ) {
    return null;
  }

  return (
    <>
      <Divider mx="$5" />
      <InfoItemGroup>
        <InfoItem
          label={
            <Button
              alignSelf="flex-start"
              variant="tertiary"
              size="small"
              iconAfter={
                shouldShowSettings
                  ? 'ChevronDownSmallOutline'
                  : 'ChevronRightSmallOutline'
              }
              onPress={() => setShouldShowSettings((prev) => !prev)}
            >
              {intl.formatMessage({
                id: ETranslations.global_advanced_settings,
              })}
            </Button>
          }
          renderContent={shouldShowSettings ? renderAdvancedSettings() : null}
        />
      </InfoItemGroup>
    </>
  );
}

export { TxAdvancedSettingsContainer };
