import React, { FC, useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Divider,
  Modal,
  Pressable,
  Searchbar,
  Text,
} from '@onekeyhq/components';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import {
  FiatPayModalRoutesParams,
  FiatPayRoutes,
} from '../../../routes/Modal/FiatPay';
import { MoonpayTokenType } from '../types';

import { MockData } from './MockData';

type NavigationProps = ModalScreenProps<FiatPayModalRoutesParams>;
type HeaderProps = {
  keyword: string;
  onChange: (keyword: string) => void;
};

const Header: FC<HeaderProps> = ({ keyword, onChange }) => {
  const intl = useIntl();
  return (
    <Box>
      <Searchbar
        w="full"
        placeholder={intl.formatMessage({
          id: 'form__search_tokens',
          defaultMessage: 'Search Tokens',
        })}
        mb="6"
        value={keyword}
        onClear={() => onChange('')}
        onChangeText={(text) => onChange(text)}
      />
    </Box>
  );
};

export const SupportTokenList: FC = () => {
  const intl = useIntl();

  const [flatListData, updateFlatListData] = useState<MoonpayTokenType[]>([]);
  const [keyword, setKeyword] = useState<string>('');
  const navigation = useNavigation<NavigationProps['navigation']>();

  const renderItem: ListRenderItem<MoonpayTokenType> = useCallback(
    ({ item, index }) => (
      <Pressable
        height="64px"
        bgColor="surface-default"
        borderTopRadius={index === 0 ? '12px' : 0}
        borderBottomRadius={index === flatListData.length - 1 ? '12px' : 0}
        onPress={() => {
          navigation.navigate(FiatPayRoutes.AmoutInputModal);
        }}
      >
        <Box
          flex={1}
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          padding="16px"
        >
          <Box flexDirection="row" alignItems="center">
            <Box
              // uri={item.logoURI}
              size="32px"
              borderRadius={16}
              bgColor="icon-default"
            />
            <Text typography="Body1Strong" ml="12px">
              {item.name}
            </Text>
          </Box>
          <Text typography="Body1Strong" color="text-subdued">
            {item.amout}
          </Text>
        </Box>
      </Pressable>
    ),
    [flatListData.length],
  );

  useEffect(() => {
    updateFlatListData(() => [...MockData]);
  }, []);
  return (
    <Modal
      height="560px"
      header={intl.formatMessage({ id: 'action__buy' })}
      hideSecondaryAction
      primaryActionProps={{
        type: 'basic',
      }}
      footer={null}
      flatListProps={{
        data: flatListData,
        // @ts-ignore
        renderItem,
        ItemSeparatorComponent: () => <Divider />,
        showsVerticalScrollIndicator: false,

        ListHeaderComponent: (
          <Header keyword={keyword} onChange={(text) => setKeyword(text)} />
        ),
      }}
    />
  );
};

export default SupportTokenList;
