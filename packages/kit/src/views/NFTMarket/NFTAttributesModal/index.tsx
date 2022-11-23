/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable camelcase */
import React, { FC, useCallback, useMemo, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { Row } from 'native-base';
import { useIntl } from 'react-intl';
import {
  LayoutAnimation,
  ListRenderItem,
  TouchableOpacity,
} from 'react-native';

import {
  Box,
  Divider,
  Icon,
  Modal,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { CollectionAttribute } from '@onekeyhq/engine/src/types/nft';

import {
  NFTAttributesContext,
  NFTAttributesContextValue,
  useNFTAttributesContext,
} from './context';
import {
  NFTAttributeFilterRoutes,
  NFTAttributeFilterRoutesParams,
} from './type';

type SubItemProps = {
  attributeName: string;
  value: {
    attributes_value: string;
    total: number;
  };
};

const SubItem: FC<SubItemProps> = ({ attributeName, value }) => {
  // const [selected, setSelected] = useState(false);
  const context = useNFTAttributesContext()?.context;
  const setContext = useNFTAttributesContext()?.setContext;

  const selected = useMemo(() => {
    if (context) {
      const item = context.selectedAttributes[attributeName];
      if (item && item.includes(value.attributes_value)) {
        return true;
      }
      return false;
    }
  }, [attributeName, context, value.attributes_value]);

  const onPressHandle = useCallback(() => {
    if (setContext) {
      setContext((ctx) => {
        const { selectedAttributes } = ctx;
        const item = selectedAttributes[attributeName] ?? [];
        if (item.includes(value.attributes_value)) {
          const index = item.findIndex((v) => v === value.attributes_value);
          item.splice(index, 1);
        } else {
          item.push(value.attributes_value);
        }
        selectedAttributes[attributeName] = item;
        return {
          selectedAttributes,
        };
      });
    }
  }, [attributeName, setContext, value.attributes_value]);

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
        <Text typography="Body2Strong">{value.attributes_value}</Text>
        <Text typography="Body2Strong" color="text-subdued">
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
  const [open, setopen] = useState(false);
  const onPressHeader = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setopen(!open);
  };

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
    <Box flexDirection="column" width="full">
      <TouchableOpacity onPress={onPressHeader}>
        <Box
          flexDirection="row"
          justifyContent="space-between"
          height="48px"
          alignItems="center"
        >
          <Text typography="Body1Strong">{attribute.attributes_name}</Text>
          <Icon name="ChevronRightSolid" size={20} />
        </Box>
      </TouchableOpacity>
      {/* <Box display={open ? 'flex' : 'none'}>{ValuesView}</Box> */}
      {open && ValuesView}
    </Box>
  );
};

const NFTAttributesModal: FC = () => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        NFTAttributeFilterRoutesParams,
        NFTAttributeFilterRoutes.FilterModal
      >
    >();

  const {
    collection,
    attributes: routeAttributes,
    onAttributeSelected,
  } = route.params;
  const attributes = collection.attributes as CollectionAttribute[];
  const renderItem: ListRenderItem<CollectionAttribute> = useCallback(
    ({ item }) => <ItemList attribute={item} />,
    [],
  );

  const defaultAtts = useMemo(() => {
    const result: Record<string, string[] | undefined> = {};
    routeAttributes.forEach((item) => {
      result[item.attribute_name] = item.attribute_values;
    });
    return result;
  }, [routeAttributes]);

  const [context, setContext] = useState<NFTAttributesContextValue>({
    selectedAttributes: defaultAtts,
  });

  const isDisabled = useMemo(() => {
    const { selectedAttributes } = context;
    for (let i = 0; i < attributes.length; i += 1) {
      const item = attributes[i];
      const { attributes_name } = item;
      const items = selectedAttributes[attributes_name];
      if (items && items.length > 0) {
        return false;
      }
    }
    return true;
  }, [attributes, context]);
  const closeModal = useModalClose();

  const onPrimaryActionPress = useCallback(() => {
    const result: Array<{
      attribute_name: string;
      attribute_values: string[];
    }> = [];
    const { selectedAttributes } = context;

    attributes.forEach((item) => {
      const { attributes_name } = item;
      const items = selectedAttributes[attributes_name];
      if (items && items.length > 0) {
        result.push({
          attribute_name: attributes_name,
          attribute_values: items,
        });
      }
    });
    if (onAttributeSelected) {
      closeModal();
      onAttributeSelected(result);
    }
  }, [attributes, closeModal, context, onAttributeSelected]);

  const isVerticalLayout = useIsVerticalLayout();
  return (
    <NFTAttributesContext.Provider value={{ context, setContext }}>
      <Modal
        primaryActionProps={{ isDisabled }}
        onPrimaryActionPress={onPrimaryActionPress}
        primaryActionTranslationId="action__apply"
        secondaryActionTranslationId="action__clear"
        onSecondaryActionPress={() => {
          if (setContext) {
            setContext({ selectedAttributes: {} });
          }
        }}
        header={intl.formatMessage({ id: 'title__filter' })}
        size="xs"
        height="640px"
        flatListProps={{
          contentContainerStyle: {
            padding: 0,
            paddingTop: isVerticalLayout ? 4 : 12,
          },
          data: attributes,
          // @ts-ignore
          renderItem,
          keyExtractor: (item) => (item as CollectionAttribute).attributes_name,
        }}
      />
    </NFTAttributesContext.Provider>
  );
};

export default NFTAttributesModal;
