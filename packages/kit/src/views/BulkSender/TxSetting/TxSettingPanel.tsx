import { useIntl } from 'react-intl';

import { isArray } from 'lodash';

import {
  Box,
  Divider,
  HStack,
  Text,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';

type Props = {
  children: React.ReactNode;
};

function TxSettingPanel(props: Props) {
  const { children } = props;
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();

  // TODO: replace entry
  return (
    <Box>
      <Text typography="Heading" mb={isVertical ? 10 : 4}>
        Transactions Settings
      </Text>
      {isVertical ? (
        <VStack>
          {isArray(children)
            ? children.map((item, index) => (
                <>
                  {item}
                  {index === children.length - 1 ? null : (
                    <Divider marginY={4} />
                  )}
                </>
              ))
            : children}
        </VStack>
      ) : (
        <HStack space={6}>{children}</HStack>
      )}
    </Box>
  );
}

export { TxSettingPanel };
