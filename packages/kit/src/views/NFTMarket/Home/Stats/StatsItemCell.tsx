import React, { ComponentProps, FC, ReactElement, useMemo } from 'react';

import { Row } from 'native-base';

import { Box, Text, useIsVerticalLayout } from '@onekeyhq/components';

type Props = {
  index?: string;
  leftComponent?: ReactElement;
  rightComponents?: ReactElement[];
  logoComponent?: ReactElement;
  title?: string;
  subTitle?: string;
} & ComponentProps<typeof Box>;

const Mobile: FC<Props> = ({
  index,
  logoComponent,
  title,
  subTitle,
  rightComponents,
  ...BoxProps
}) => {
  const components = useMemo(
    () =>
      rightComponents?.map((item) => <Box justifyContent="center">{item}</Box>),
    [rightComponents],
  );
  return (
    <Row
      justifyContent="space-between"
      space="12px"
      alignItems="center"
      {...BoxProps}
    >
      {logoComponent}
      <Row flex={1}>
        {index && (
          <Text
            width="30px"
            numberOfLines={1}
            typography="Body1Strong"
            mr="6px"
          >
            {index}
          </Text>
        )}

        <Box flexDirection="column" flex={1}>
          <Text typography="Body1Strong" numberOfLines={1}>
            {title}
          </Text>
          <Text color="text-subdued" typography="Body2" numberOfLines={1}>
            {subTitle}
          </Text>
        </Box>
      </Row>
      {components}
    </Row>
  );
};
const Desktop: FC<Props> = ({
  index,
  logoComponent,
  title,
  leftComponent,
  subTitle,
  rightComponents,
  ...BoxProps
}) => {
  const components = useMemo(
    () =>
      rightComponents?.map((item) => (
        <Box flex={1} justifyContent="center">
          {item}
        </Box>
      )),
    [rightComponents],
  );
  return (
    <Row
      justifyContent="space-between"
      alignItems="center"
      space="12px"
      {...BoxProps}
    >
      {leftComponent ? (
        <Row flex={1.9} space="12px">
          {leftComponent}
        </Row>
      ) : (
        <Row flex={1.9} space="12px" alignItems="center">
          {index && (
            <Text width="30px" typography="Body1Strong">
              {index}
            </Text>
          )}

          {logoComponent}
          <Box flexDirection="column" flex={1}>
            <Text typography="Body1Strong" numberOfLines={1}>
              {title}
            </Text>
            <Text color="text-subdued" typography="Body2" numberOfLines={1}>
              {subTitle}
            </Text>
          </Box>
        </Row>
      )}
      {components}
    </Row>
  );
};
const StatsItemCell: FC<Props> = ({ ...rest }) => {
  const isSmallScreen = useIsVerticalLayout();
  return isSmallScreen ? <Mobile {...rest} /> : <Desktop {...rest} />;
};

export default StatsItemCell;
