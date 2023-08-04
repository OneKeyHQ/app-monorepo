import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { FlatList } from 'react-native';

import { HStack, Icon, Pressable, Text, VStack } from '@onekeyhq/components';
import Checkbox from '@onekeyhq/components/src/CheckBox';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';

import { FormatCurrencyNativeOfAccount } from '../../components/Format';
import OrdinalsSVG from '../../components/SVG/OrdinalsSVG';
import { useNavigation, useNetworkSimple } from '../../hooks';
import useFormatDate from '../../hooks/useFormatDate';
import {
  CollectiblesModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../routes/routesEnum';

import type { FlatListProps } from 'react-native';

type Props = {
  inscriptions: NFTBTCAssetModel[];
  accountId: string;
  networkId: string;
  isSelectMode: boolean;
  selectedInscriptions: string[];
  setSelectedInscriptions: React.Dispatch<React.SetStateAction<string[]>>;
};

function InscriptionList(props: Props) {
  const {
    inscriptions,
    accountId,
    networkId,
    isSelectMode,
    selectedInscriptions,
    setSelectedInscriptions,
  } = props;
  const intl = useIntl();
  const { formatDistanceToNow } = useFormatDate();
  const network = useNetworkSimple(networkId);
  const navigation = useNavigation();

  const handleInscriptionOnPress = useCallback(
    (item: NFTBTCAssetModel) => {
      if (isSelectMode) {
        setSelectedInscriptions((prev: string[]) => {
          if (prev.includes(item.inscription_id)) {
            return prev.filter((ele) => ele !== item.inscription_id);
          }
          return [...prev, item.inscription_id];
        });
      } else {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Collectibles,
          params: {
            screen: CollectiblesModalRoutes.NFTDetailModal,
            params: {
              asset: item,
              networkId,
              accountId,
              isOwner: true,
            },
          },
        });
      }
    },
    [accountId, isSelectMode, navigation, networkId, setSelectedInscriptions],
  );

  const renderItem = useCallback<
    NonNullable<FlatListProps<NFTBTCAssetModel>['renderItem']>
  >(
    ({ item }) => (
      <Pressable onPress={() => handleInscriptionOnPress(item)}>
        <HStack alignItems="center" mb={4} justifyContent="space-between">
          <HStack alignItems="center">
            {isSelectMode ? (
              <Checkbox
                isChecked={selectedInscriptions.includes(item.inscription_id)}
              />
            ) : null}
            <VStack>
              <HStack alignItems="center">
                <OrdinalsSVG />
                <Text typography="Body2Strong">#{item.inscription_number}</Text>
                {isSelectMode ? null : (
                  <Icon
                    name="ChevronRightMini"
                    size={20}
                    color="icon-subdued"
                  />
                )}
              </HStack>
              <Text typography="Body2" color="text-subdued">
                {formatDistanceToNow(
                  new BigNumber(item.timestamp).times(1000).toNumber(),
                )}
              </Text>
            </VStack>
          </HStack>
          <VStack>
            <Text textAlign="right" typography="Body2Strong">{`${new BigNumber(
              item.output_value_sat,
            )
              .shiftedBy(-(network?.decimals ?? '8'))
              .toFixed()} ${network?.symbol ?? ''}`}</Text>
            <FormatCurrencyNativeOfAccount
              networkId={networkId}
              accountId={accountId}
              value={new BigNumber(item.output_value_sat).shiftedBy(
                -(network?.decimals ?? '8'),
              )}
              render={(ele) => (
                <Text textAlign="right" typography="Body2" color="text-subdued">
                  {ele}
                </Text>
              )}
            />
          </VStack>
        </HStack>
      </Pressable>
    ),
    [
      accountId,
      formatDistanceToNow,
      handleInscriptionOnPress,
      isSelectMode,
      network?.decimals,
      network?.symbol,
      networkId,
      selectedInscriptions,
    ],
  );

  const isSelectedAll = useMemo(
    () =>
      selectedInscriptions.length > 0 &&
      selectedInscriptions.length === inscriptions.length,
    [inscriptions.length, selectedInscriptions.length],
  );

  const isIndeterminate = useMemo(
    () =>
      selectedInscriptions.length > 0 &&
      selectedInscriptions.length < inscriptions.length,
    [inscriptions.length, selectedInscriptions.length],
  );

  const handleToggleAllSelect = useCallback(() => {
    if (isSelectedAll) {
      setSelectedInscriptions([]);
    } else {
      setSelectedInscriptions(inscriptions.map((ele) => ele.inscription_id));
    }
  }, [inscriptions, isSelectedAll, setSelectedInscriptions]);

  const listHeader = useMemo(
    () => (
      <Pressable isDisabled={!isSelectMode} onPress={handleToggleAllSelect}>
        <HStack justifyContent="space-between" alignItems="center" mb={4}>
          <HStack alignItems="center">
            {isSelectMode ? (
              <Checkbox
                isChecked={isSelectedAll || isIndeterminate}
                isIndeterminate={isIndeterminate}
                defaultIsChecked={false}
              />
            ) : null}
            <Text
              typography="Subheading"
              textTransform="uppercase"
              color="text-subdued"
            >
              {intl.formatMessage({ id: 'form__inscription_id_uppercase' })}
            </Text>
          </HStack>
          <Text
            typography="Subheading"
            textTransform="uppercase"
            color="text-subdued"
            textAlign="right"
          >
            {intl.formatMessage({ id: 'form__utxo_value_uppercase' })}
          </Text>
        </HStack>
      </Pressable>
    ),
    [handleToggleAllSelect, intl, isIndeterminate, isSelectMode, isSelectedAll],
  );
  return (
    <>
      {listHeader}
      <FlatList
        data={inscriptions}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </>
  );
}

export { InscriptionList };
