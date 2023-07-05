import { useMemo } from 'react';

import {
  HStack,
  VStack,
  useIsVerticalLayout,
  Center,
} from '@onekeyhq/components';

import { BulkSenderModeEnum } from '../types';

import { ModeItem } from './ModeItem';

type Props = {
  isSupportedOneToMany: boolean;
  isSupportedManyToMany: boolean;
  isSupportedManyToOne: boolean;
};

const modeItemCommonStyle = {};

const modeItemInVerticalLayoutStyle = {
  padding: 4,
  ...modeItemCommonStyle,
};

const modeItemInHorizontalLayoutStyle = {
  width: '200px',
  height: '380px',
  justifyContent: 'center',
  alignItems: 'center',
  ...modeItemCommonStyle,
};

function ModelSelector(props: Props) {
  const { isSupportedManyToMany, isSupportedManyToOne, isSupportedOneToMany } =
    props;

  const isVertical = useIsVerticalLayout();

  const modes = useMemo(
    () =>
      [
        isSupportedOneToMany && BulkSenderModeEnum.OneToMany,
        isSupportedManyToMany && BulkSenderModeEnum.ManyToMany,
        isSupportedManyToOne && BulkSenderModeEnum.ManyToOne,
      ]
        .filter((mode) => !!mode)
        .map((mode) => (
          <ModeItem
            mode={mode as BulkSenderModeEnum}
            {...(isVertical
              ? modeItemInVerticalLayoutStyle
              : modeItemInHorizontalLayoutStyle)}
          />
        )),

    [
      isSupportedManyToMany,
      isSupportedManyToOne,
      isSupportedOneToMany,
      isVertical,
    ],
  );

  return isVertical ? (
    <VStack space={3} padding={4}>
      {modes}
    </VStack>
  ) : (
    <Center width="full" height="full">
      <HStack space={6}>{modes}</HStack>
    </Center>
  );
}

export { ModelSelector };
