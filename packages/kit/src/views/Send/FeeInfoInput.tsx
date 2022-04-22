import React, { useCallback } from 'react';

import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Spinner,
  Text,
  Typography,
} from '@onekeyhq/components';
import { IFeeInfoPayload } from '@onekeyhq/engine/src/types/vault';

import { FormatBalance, FormatCurrencyNative } from '../../components/Format';
import useNavigation from '../../hooks/useNavigation';

import { FeeSpeedLabel } from './SendEditFee';
import { TxTitleDetailView } from './TxTitleDetailView';
import { SendRoutes, SendRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.SendConfirm
>;

function FeeInfoInput({
  encodedTx,
  feeInfoPayload,
  loading,
  renderChildren,
  editable,
  backRouteName,
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading?: boolean;
  editable?: boolean;
  backRouteName?: keyof SendRoutesParams;
  renderChildren: ({ isHovered }: { isHovered: boolean }) => any;
}) {
  const navigation = useNavigation<NavigationProps>();

  return (
    <Pressable
      disabled={loading || !editable || !encodedTx}
      onPress={() => {
        if (loading) {
          return;
        }
        navigation.navigate(SendRoutes.SendEditFee, {
          backRouteName: backRouteName ?? SendRoutes.SendConfirm,
          encodedTx,
          feeInfoSelected: feeInfoPayload?.selected,
        });
      }}
    >
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
  const renderChildren = useCallback(
    ({ isHovered }) => {
      let totalDetailText = `${feeInfoPayload?.current?.total ?? '-'} ${
        feeInfoPayload?.info?.symbol ?? ''
      }`;
      const isPreset = feeInfoPayload?.selected?.type === 'preset';
      if (isPreset) {
        totalDetailText = `(${totalDetailText})`;
      }
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
      return (
        // fee TODO encodedTxRef.current -> bg -> unsignedTx -> gasLimit -> feeInfo
        <Row
          justifyContent="space-between"
          alignItems="center"
          bgColor={isHovered ? 'surface-hovered' : 'surface-default'}
          borderColor="border-default"
          borderWidth="1px"
          borderRadius="12px"
          paddingX="12px"
          paddingY="8px"
        >
          <Column>
            <Row>
              <Box>
                <Text
                  typography={{
                    sm: 'Body1Strong',
                    md: 'Body2Strong',
                  }}
                >
                  {isPreset ? (
                    <FeeSpeedLabel index={feeInfoPayload?.selected?.preset} />
                  ) : null}{' '}
                  {/* {totalDetailText} */}
                </Text>
              </Box>
              <Box>
                <FormatCurrencyNative
                  value={feeInfoPayload?.current?.totalNative}
                  render={(ele) => (
                    <Typography.Body2 mt={1} color="text-subdued">
                      (~ {!feeInfoPayload?.current?.totalNative ? '-' : ele})
                    </Typography.Body2>
                  )}
                />
              </Box>
            </Row>
            <Row>
              <Box>
                <Text color="text-subdued">Likely in 15s</Text>
              </Box>
            </Row>

            {/* <Typography.Body2 color="text-subdued">
                          0.001694 ETH ~ 0.001977 ETH
                        </Typography.Body2> */}
            {/* <Typography.Body2 color="text-subdued">
                          3 min
                        </Typography.Body2> */}
          </Column>

          {icon}
        </Row>
      );
    },
    [encodedTx, feeInfoPayload, loading],
  );
  return (
    <FeeInfoInput
      editable
      backRouteName={SendRoutes.Send}
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
      backRouteName={SendRoutes.SendConfirm}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={loading}
      renderChildren={renderChildren}
    />
  );
}

export { FeeInfoInput, FeeInfoInputForTransfer, FeeInfoInputForConfirm };
