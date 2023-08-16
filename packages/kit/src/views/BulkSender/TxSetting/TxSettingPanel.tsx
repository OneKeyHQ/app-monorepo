import { isArray } from 'lodash';
import { useIntl } from 'react-intl';

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
  const isVertical = useIsVerticalLayout();
  const intl = useIntl();

  return (
    <Box>
      <Text typography="Heading" mb={isVertical ? 10 : 4}>
        {intl.formatMessage({ id: 'title__transaction_settings' })}
      </Text>
      {isVertical ? (
        <VStack>
          {isArray(children)
            ? children.map((item, index) => (
                <Box key={index}>
                  {item}
                  {index === children.length - 1 ? null : (
                    <Divider marginY={4} />
                  )}
                </Box>
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
