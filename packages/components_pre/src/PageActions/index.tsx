import type { FC } from 'react';

import Box from '../Box';
import Button from '../Button';
import Divider from '../Divider';
import Typography from '../Typography';

import type { IBoxProps } from 'native-base';

interface IPageActionProps extends IBoxProps<IPageActionProps> {
  primaryButton: string;
  secondaryButton?: string;
  title?: string;
  content?: string;
  moreContent?: string;
  onPrimaryButtonPress?: () => void;
  onSecondaryButtonPress?: () => void;
}

export type PageActionProps = IPageActionProps;

const PageActions: FC<PageActionProps> = ({
  primaryButton,
  secondaryButton,
  title,
  content,
  moreContent,
  onPrimaryButtonPress,
  onSecondaryButtonPress,
  ...props
}) => (
  <Box {...props} flexDirection="column" w="100%">
    <Divider bg="border-subdued" />
    <Box w="100%" pr={4} pl={4} mt={4} mb={8}>
      <Box flexDirection="row" justifyContent="center" alignItems="center">
        {!!secondaryButton && (
          <Button
            size="lg"
            flex={1}
            mr={4}
            type="basic"
            onPress={() => onSecondaryButtonPress}
          >
            {secondaryButton}
          </Button>
        )}
        {!!title && content && !secondaryButton && (
          <Box flexDirection="column" w="3/5" mr={4}>
            <Typography.Body2 color="text-subdued">{title}</Typography.Body2>
            <Typography.Body1 color="text-default">{content}</Typography.Body1>
            <Typography.Caption color="text-subdued">
              {moreContent}
            </Typography.Caption>
          </Box>
        )}
        <Button
          size="lg"
          height={42}
          flex={1}
          type="primary"
          onPress={() => onPrimaryButtonPress}
        >
          {primaryButton}
        </Button>
      </Box>
    </Box>
  </Box>
);

export default PageActions;
