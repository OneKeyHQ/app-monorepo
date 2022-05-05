import React, { useCallback, useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Spinner, Text } from '@onekeyhq/components';
import { IFeeInfoPayload } from '@onekeyhq/engine/src/types/vault';

import { FormatCurrencyNative } from '../../components/Format';

import { FeeSpeedLabel } from './SendEditFee';
import { TxTitleDetailView } from './TxTitleDetailView';
import { SendRoutes, SendRoutesParams } from './types';

import type { StackNavigationProp } from '@react-navigation/stack';

type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendRoutes.SendConfirm
>;

function FeeInfoInput({
  encodedTx,
  feeInfoPayload,
  loading,
  renderChildren,
  editable,
  autoNavigateToEdit,
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading?: boolean;
  editable?: boolean;
  renderChildren: ({ isHovered }: { isHovered: boolean }) => any;
  autoNavigateToEdit?: boolean;
}) {
  const navigation = useNavigation<NavigationProps>();
  const disabled = loading || !editable || !encodedTx;
  const navigateToEdit = useCallback(
    ({ replace = false }: { replace?: boolean } = {}) => {
      if (disabled) {
        return;
      }
      if (replace) {
        navigation.replace(SendRoutes.SendEditFee, {
          encodedTx,
          feeInfoSelected: feeInfoPayload?.selected,
          autoConfirmAfterFeeSaved: autoNavigateToEdit,
        });
      } else {
        navigation.navigate({
          // merge: true,
          // headerLeft: null,
          name: SendRoutes.SendEditFee,
          params: {
            encodedTx,
            feeInfoSelected: feeInfoPayload?.selected,
            autoConfirmAfterFeeSaved: autoNavigateToEdit,
          },
        });
      }
    },
    [
      disabled,
      encodedTx,
      feeInfoPayload?.selected,
      autoNavigateToEdit,
      navigation,
    ],
  );

  useEffect(() => {
    if (autoNavigateToEdit) {
      // replace not working
      navigateToEdit({ replace: true });
    }
  }, [autoNavigateToEdit, navigateToEdit]);

  return (
    <Pressable disabled={disabled} onPress={() => navigateToEdit()}>
      {renderChildren}
    </Pressable>
  );
}

function FeeInfoInputForTransfer({
  encodedTx,
  feeInfoPayload,
  loading,
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading: boolean;
}) {
  const intl = useIntl();
  const renderChildren = useCallback(
    ({ isHovered }) => {
      const isPreset = feeInfoPayload?.selected?.type === 'preset';
      let icon: React.ReactElement | null = (
        <Icon size={20} name="PencilSolid" />
      );
      if (!encodedTx) {
        icon = null;
      }
      if (feeInfoPayload) {
        icon = <Icon size={20} name="PencilSolid" />;
      }
      if (loading) {
        icon = <Spinner size="sm" />;
      }
      let feeSpeedTime = '';
      if (feeInfoPayload?.selected?.type === 'preset') {
        if (feeInfoPayload?.selected?.preset === '0')
          feeSpeedTime = intl.formatMessage({
            id: 'content__maybe_in_30s',
          });
        if (feeInfoPayload?.selected?.preset === '1')
          feeSpeedTime = intl.formatMessage({
            id: 'content__likely_less_than_15s',
          });
        if (feeInfoPayload?.selected?.preset === '2')
          feeSpeedTime = intl.formatMessage({
            id: 'content__very_likely_less_than_15s',
          });
      }
      return (
        // fee TODO encodedTxRef.current -> bg -> unsignedTx -> gasLimit -> feeInfo
        <Box
          justifyContent="space-between"
          alignItems="center"
          flexDirection="row"
          bgColor={isHovered ? 'surface-hovered' : 'surface-default'}
          borderColor="border-default"
          borderWidth="1px"
          borderRadius="12px"
          paddingX="12px"
          paddingY="8px"
        >
          <Box flex={1}>
            {(isPreset || feeInfoPayload?.current?.totalNative) && (
              <Text
                typography={{
                  sm: 'Body1Strong',
                  md: 'Body2Strong',
                }}
              >
                {isPreset ? (
                  <>
                    <FeeSpeedLabel index={feeInfoPayload?.selected?.preset} />{' '}
                    <FormatCurrencyNative
                      value={feeInfoPayload?.current?.totalNative}
                      render={(ele) => <>(~ {ele})</>}
                    />
                  </>
                ) : (
                  <>
                    <FormatCurrencyNative
                      value={feeInfoPayload?.current?.totalNative}
                      render={(ele) => <>{ele}</>}
                    />
                  </>
                )}
              </Text>
            )}
            {isPreset && (
              <Text color="text-subdued" flex={1}>
                {feeInfoPayload?.current?.totalNative && feeSpeedTime}
              </Text>
            )}
            {!feeInfoPayload?.current?.totalNative && (
              <Text color="text-subdued" flex={1}>
                {loading
                  ? intl.formatMessage({ id: 'content__just_a_moment' })
                  : intl.formatMessage({ id: 'content__calculate_fee' })}
              </Text>
            )}
          </Box>
          {icon}
        </Box>
      );
    },
    [encodedTx, feeInfoPayload, intl, loading],
  );
  return (
    <FeeInfoInput
      editable
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={loading}
      renderChildren={renderChildren}
    />
  );
}

function FeeInfoInputForConfirm({
  encodedTx,
  feeInfoPayload,
  loading,
  editable,
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading?: boolean;
  editable?: boolean;
}) {
  const intl = useIntl();

  const renderChildren = useCallback(
    ({ isHovered }) => (
      <TxTitleDetailView
        isHovered={isHovered}
        arrow={editable && !loading && !!feeInfoPayload}
        title={`${intl.formatMessage({
          id: 'content__fee',
        })}(${intl.formatMessage({ id: 'content__estimated' })})`}
        detail={
          loading ? (
            <Spinner />
          ) : (
            `${feeInfoPayload?.current?.totalNative || '-'} ${
              feeInfoPayload?.info?.nativeSymbol || ''
            }`
          )
        }
      />
    ),
    [editable, feeInfoPayload, intl, loading],
  );
  return (
    <FeeInfoInput
      editable={editable}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={loading}
      renderChildren={renderChildren}
    />
  );
}

function FeeInfoInputForSpeedUpOrCancel({
  encodedTx,
  feeInfoPayload,
  loading,
  editable,
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading?: boolean;
  editable?: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderChildren = useCallback(({ isHovered }) => null, []);
  return (
    <FeeInfoInput
      editable={editable}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={loading}
      renderChildren={renderChildren}
      autoNavigateToEdit
    />
  );
}

export {
  FeeInfoInput,
  FeeInfoInputForTransfer,
  FeeInfoInputForConfirm,
  FeeInfoInputForSpeedUpOrCancel,
};
