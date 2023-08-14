import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  HStack,
  Pressable,
  Text,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';

import { useNavigation } from '../../../hooks';
import { HomeRoutes } from '../../../routes/routesEnum';

import ManyToManyIcon from './ManyToManyIcon';
import ManyToOneIcon from './ManyToOneIcon';
import OneToManyIcon from './OneToManyIcon';

import type { HomeRoutesParams } from '../../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MessageDescriptor } from 'react-intl';

type Props = {
  mode: BulkTypeEnum;
} & ComponentProps<typeof Pressable>;

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

function AddressElement({ elementText }: { elementText: string }) {
  return (
    <Box
      width="24px"
      height="24px"
      borderRadius="full"
      bgColor="surface-neutral-default"
      alignItems="center"
      justifyContent="center"
    >
      <Text textAlign="center" typography="CaptionStrong">
        {elementText}
      </Text>
    </Box>
  );
}

function OneToMany() {
  return (
    <HStack space={3} alignItems="center" justifyContent="center">
      <AddressElement elementText="A" />
      <OneToManyIcon />
      <VStack space={2}>
        {['I', 'II', 'III'].map((text) => (
          <AddressElement elementText={text} />
        ))}
      </VStack>
    </HStack>
  );
}

function ManyToMany() {
  return (
    <HStack space={3} alignItems="center" justifyContent="center">
      <VStack space={2}>
        {['A', 'B', 'C'].map((text) => (
          <AddressElement elementText={text} />
        ))}
      </VStack>
      <ManyToManyIcon width="24px" />
      <VStack space={2}>
        {['I', 'II', 'III'].map((text) => (
          <AddressElement elementText={text} />
        ))}
      </VStack>
    </HStack>
  );
}

function ManyToOne() {
  return (
    <HStack space={3} alignItems="center" justifyContent="center">
      <VStack space={2}>
        {['I', 'II', 'III'].map((text) => (
          <AddressElement elementText={text} />
        ))}
      </VStack>
      <ManyToOneIcon />
      <VStack>
        <AddressElement elementText="A" />
      </VStack>
    </HStack>
  );
}

function getModeInfo(mode: BulkTypeEnum): null | {
  title: MessageDescriptor['id'];
  desc: MessageDescriptor['id'];
  mark: React.ReactNode;
} {
  if (mode === BulkTypeEnum.OneToMany)
    return {
      title: 'form__one_to_many',
      desc: 'form__one_to_many_desc',
      mark: <OneToMany />,
    };
  if (mode === BulkTypeEnum.ManyToOne)
    return {
      title: 'form__many_to_one',
      desc: 'form__many_to_one_desc',
      mark: <ManyToOne />,
    };
  if (mode === BulkTypeEnum.ManyToMany)
    return {
      title: 'form__many_to_many',
      desc: 'form__many_to_many_desc',
      mark: <ManyToMany />,
    };

  return null;
}

function ModeItem(props: Props) {
  const { mode, isDisabled, ...rest } = props;
  const isVertical = useIsVerticalLayout();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const modeInfo = getModeInfo(mode);

  if (!modeInfo) return null;

  const { title, desc, mark } = modeInfo;

  return (
    <Pressable
      bg={isDisabled ? 'surface-subdued' : 'surface-default'}
      _hover={{ bg: 'surface-hovered' }}
      _pressed={{ bg: 'surface-pressed' }}
      borderColor="border-subdued"
      borderWidth={1}
      borderRadius="12px"
      onPress={() => navigation.navigate(HomeRoutes.BulkSender, { mode })}
      isDisabled={isDisabled}
      {...rest}
    >
      {isVertical ? (
        <HStack alignItems="center" space={10}>
          {mark}
          <VStack justifyContent="center" alignItems="flex-start">
            <Text typography="Heading">
              {intl.formatMessage({ id: title })}
            </Text>
            <Text typography="Body1" color="text-subdued">
              {intl.formatMessage({ id: desc })}
            </Text>
            <Box>
              {isDisabled ? (
                <Badge
                  mt={1}
                  size="sm"
                  title={intl.formatMessage({ id: 'content__stay_tuned' })}
                  type="info"
                />
              ) : null}
            </Box>
          </VStack>
        </HStack>
      ) : (
        <VStack>
          {mark}
          <Text
            typography="Heading"
            textAlign="center"
            mt="52px"
            color={isDisabled ? 'text-subdued' : 'text-default'}
          >
            {intl.formatMessage({ id: title })}
          </Text>
          <Text
            typography="Body1"
            textAlign="center"
            color={isDisabled ? 'text-disabled' : 'text-subdued'}
          >
            {intl.formatMessage({ id: desc })}
          </Text>
        </VStack>
      )}
      {isDisabled && !isVertical ? (
        <Badge
          position="absolute"
          bottom={4}
          size="sm"
          title={intl.formatMessage({ id: 'content__stay_tuned' })}
          type="info"
        />
      ) : null}
    </Pressable>
  );
}

export { ModeItem };
