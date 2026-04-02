import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNaN, isNil } from 'lodash';
import { useIntl } from 'react-intl';

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
  useSendConfirmActions,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

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

function TxAdvancedSettingsContainer(props: IProps) {
  const { accountId, networkId } = props;
  const intl = useIntl();
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [settings] = useSettingsPersistAtom();
  const { updateTxAdvancedSettings } = useSendConfirmActions().current;

  const [shouldShowSettings, setShouldShowSettings] = useState<boolean>(false);

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
      !unsignedTxs[0]?.isInternalSwap &&
      vaultSettings?.canEditNonce &&
      settings.isCustomNonceEnabled &&
      !isNil(unsignedTxs[0]?.nonce),
    [settings.isCustomNonceEnabled, unsignedTxs, vaultSettings?.canEditNonce],
  );

  const currentNonce = new BigNumber(unsignedTxs[0]?.nonce ?? 0).toFixed();

  const form = useForm({
    defaultValues: {
      nonce: currentNonce,
      data: dataContent,
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
            id: ETranslations.global_hex_data_default,
          })}
          name="data"
          labelAddon={
            <Button
              size="small"
              variant="tertiary"
              onPress={() => showHexDataFaq()}
            >
              {intl.formatMessage({
                id: ETranslations.global_hex_data_default_faq,
              })}
            </Button>
          }
        >
          <TextAreaInput editable={false} flex={1} />
        </Form.Field>
      </Form>
    ),
    [
      canEditNonce,
      currentNonce,
      form,
      handleValidateNonce,
      intl,
      updateTxAdvancedSettings,
    ],
  );

  useEffect(() => {
    form.setValue('data', dataContent);
  }, [dataContent, form]);

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
