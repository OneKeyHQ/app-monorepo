import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Pressable,
  Text,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { BulkSenderModeEnum } from '../types';

import GroupIcon from './GroupIcon';

import type { MessageDescriptor } from 'react-intl';

type Props = {
  mode: BulkSenderModeEnum;
} & ComponentProps<typeof Pressable>;

function AddressElement({ elementText }: { elementText: string }) {
  return (
    <Box
      width="24px"
      height="24px"
      borderRadius="full"
      bgColor="surface-neutral-default"
      alignItems="ceter"
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
      <GroupIcon />
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
      <GroupIcon />
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
      <GroupIcon />
      <VStack>
        <AddressElement elementText="A" />
      </VStack>
    </HStack>
  );
}

function getModeInfo(mode: BulkSenderModeEnum): null | {
  title: MessageDescriptor['id'];
  desc: MessageDescriptor['id'];
  mark: React.ReactNode;
} {
  if (mode === BulkSenderModeEnum.OneToMany)
    return {
      title: 'form__one_to_many',
      desc: 'form__one_to_many_desc',
      mark: <OneToMany />,
    };
  if (mode === BulkSenderModeEnum.ManyToOne)
    return {
      title: 'form__many_to_one',
      desc: 'form__many_to_one_desc',
      mark: <ManyToOne />,
    };
  if (mode === BulkSenderModeEnum.ManyToMany)
    return {
      title: 'form__many_to_many',
      desc: 'form__many_to_many_desc',
      mark: <ManyToMany />,
    };

  return null;
}

function ModeItem(props: Props) {
  const { mode, ...rest } = props;
  const isVertical = useIsVerticalLayout();
  const intl = useIntl();

  const modeInfo = getModeInfo(mode);

  if (!modeInfo) return null;

  const { title, desc, mark } = modeInfo;

  console.log(modeInfo);

  return (
    <Pressable
      bg="surface-default"
      _hover={{ bg: 'surface-hovered' }}
      _pressed={{ bg: 'surface-pressed' }}
      borderColor="border-subdued"
      borderWidth={1}
      borderRadius="12px"
      {...rest}
    >
      {isVertical ? (
        <HStack alignItems="center" space={12}>
          {mark}
          <VStack>
            <Text typography="Heading">
              {intl.formatMessage({ id: title })}
            </Text>
            <Text typography="Body1" color="text-subdued">
              {intl.formatMessage({ id: desc })}
            </Text>
          </VStack>
        </HStack>
      ) : (
        <VStack>
          {mark}
          <Text typography="Heading" textAlign="center" mt="52px">
            {intl.formatMessage({ id: title })}
          </Text>
          <Text typography="Body1" color="text-subdued" textAlign="center">
            {intl.formatMessage({ id: desc })}
          </Text>
        </VStack>
      )}
    </Pressable>
  );
}

export { ModeItem };
