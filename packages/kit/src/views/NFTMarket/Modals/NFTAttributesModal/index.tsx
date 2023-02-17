/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable camelcase */
import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { MotiView } from 'moti';
import { Row } from 'native-base';
import { useIntl } from 'react-intl';
import { TouchableOpacity } from 'react-native';

import {
  Box,
  Collapse,
  Divider,
  Icon,
  Modal,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import type { CollectionAttribute } from '@onekeyhq/engine/src/types/nft';

import { NFTAttributesContext, useNFTAttributesContext } from './context';
import {
  clearAttributeStatus,
  generteAttributeParams,
  getAttributesStatus,
  isAttributeNameSelected,
  isSelectedAttribute,
  setAttributesStatus,
} from './refs';

import type { NFTMarketRoutes, NFTMarketRoutesParams } from '../type';
import type { NFTAttributesContextValue } from './context';
import type { RouteProp } from '@react-navigation/core';
import type { ListRenderItem } from 'react-native';

type SubItemProps = {
  attributeName: string;
  value: {
    attributes_value: string;
    total: number;
  };
};

const SubItem: FC<SubItemProps> = ({ attributeName, value }) => {
  const [selected, setSelected] = useState(
    getAttributesStatus({
      attributeName,
      attributesValue: value.attributes_value,
    }),
  );
  const context = useNFTAttributesContext()?.context;
  useEffect(() => {
    const status = getAttributesStatus({
      attributeName,
      attributesValue: value.attributes_value,
    });
    setSelected(status);
  }, [attributeName, context?.clearFlag, value.attributes_value]);

  const onPressHandle = useCallback(() => {
    setSelected((prev) => {
      setAttributesStatus({
        attributeName,
        attributesValue: value.attributes_value,
        enable: !prev,
      });
      if (context && context.setIsDisabled) {
        context.setIsDisabled(!isSelectedAttribute());
      }
      return !prev;
    });
  }, [attributeName, context, value.attributes_value]);

  return (
    <TouchableOpacity onPress={onPressHandle}>
      <Box
        mb="8px"
        mr="8px"
        flexDirection="row"
        px="10px"
        py="4px"
        borderRadius="14px"
        bgColor={selected ? 'interactive-default' : 'surface-neutral-subdued'}
        height="28px"
      >
        <Text
          typography="Body2Strong"
          color={selected ? 'text-on-primary' : 'text-default'}
        >
          {value.attributes_value}
        </Text>
        <Text
          typography="Body2Strong"
          color={selected ? 'text-on-primary' : 'text-subdued'}
          opacity={selected ? 0.65 : 1}
        >
          {` ${value.total}`}
        </Text>
      </Box>
    </TouchableOpacity>
  );
};

type ItemProps = {
  attribute: CollectionAttribute;
};

const ItemList: FC<ItemProps> = ({ attribute }) => {
  const ValuesView = useMemo(
    () => (
      <Box>
        <Row flexWrap="wrap" mb="12px">
          {attribute.attributes_values.map((value) => (
            <SubItem
              key={value.attributes_value}
              value={value}
              attributeName={attribute.attributes_name}
            />
          ))}
        </Row>
        <Divider />
      </Box>
    ),
    [attribute.attributes_name, attribute.attributes_values],
  );
  return (
    <Collapse
      defaultCollapsed={!isAttributeNameSelected(attribute.attributes_name)}
      renderCustomTrigger={(onPress, collapsed) => (
        <TouchableOpacity onPress={onPress}>
          <Box
            flexDirection="row"
            justifyContent="space-between"
            height="48px"
            alignItems="center"
          >
            <Text typography="Body1Strong">{attribute.attributes_name}</Text>
            <MotiView animate={{ rotate: collapsed ? '0deg' : '90deg' }}>
              <Icon name="ChevronRightMini" color="icon-subdued" size={20} />
            </MotiView>
          </Box>
        </TouchableOpacity>
      )}
    >
      {ValuesView}
    </Collapse>
  );
};

const NFTAttributesModal: FC = () => {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<NFTMarketRoutesParams, NFTMarketRoutes.FilterModal>>();

  const {
    collection,
    attributes: routeAttributes,
    onAttributeSelected,
  } = route.params;

  const [flatListData, updateListData] = useState<CollectionAttribute[]>([]);

  const [isDisabled, setIsDisabled] = useState(false);

  const [context, setContext] = useState<NFTAttributesContextValue>({
    clearFlag: 0,
    setIsDisabled,
  });

  const loadData = useCallback(async () => {
    routeAttributes.forEach(
      ({ attribute_name: attributeName, attribute_values }) => {
        attribute_values.forEach((attributesValue) => {
          setAttributesStatus({ attributeName, attributesValue, enable: true });
        });
      },
    );
    const data = collection.attributes?.filter(
      ({ attributes_values }) => attributes_values.length < 100,
    ) as CollectionAttribute[];
    return Promise.resolve(data);
  }, [collection.attributes, routeAttributes]);

  useEffect(() => {
    // const startDate = new Date().getTime();
    loadData().then((data) => {
      // console.log('time : ', new Date().getTime() - startDate);
      updateListData(data);
      setIsDisabled(!isSelectedAttribute());
    });

    return () => {
      clearAttributeStatus();
    };
  }, [loadData, routeAttributes]);

  const closeModal = useModalClose();

  const onPrimaryActionPress = useCallback(() => {
    const result = generteAttributeParams();
    if (onAttributeSelected) {
      closeModal();
      onAttributeSelected(result);
    }
  }, [closeModal, onAttributeSelected]);

  const isVerticalLayout = useIsVerticalLayout();

  const contextValue = useMemo(() => ({ context, setContext }), [context]);

  const renderItem: ListRenderItem<CollectionAttribute> = useCallback(
    ({ item }) => <ItemList attribute={item} />,
    [],
  );

  const flatListProps = useMemo(
    () => ({
      contentContainerStyle: {
        padding: 0,
        paddingTop: isVerticalLayout ? 4 : 12,
      },
      data: flatListData,
      renderItem,
      keyExtractor: (item: CollectionAttribute) => item.attributes_name,
    }),
    [isVerticalLayout, renderItem, flatListData],
  );

  return (
    <NFTAttributesContext.Provider value={contextValue}>
      <Modal
        primaryActionProps={{ isDisabled }}
        onPrimaryActionPress={onPrimaryActionPress}
        primaryActionTranslationId="action__apply"
        secondaryActionTranslationId="action__clear"
        onSecondaryActionPress={() => {
          clearAttributeStatus();
          setIsDisabled(routeAttributes.length === 0);
          setContext((ctx) => ({
            ...ctx,
            clearFlag: ctx.clearFlag + 1,
          }));
        }}
        header={intl.formatMessage({ id: 'title__filter' })}
        size="md"
        height="640px"
        // @ts-ignore
        flatListProps={flatListProps}
      />
    </NFTAttributesContext.Provider>
  );
};

export default NFTAttributesModal;
