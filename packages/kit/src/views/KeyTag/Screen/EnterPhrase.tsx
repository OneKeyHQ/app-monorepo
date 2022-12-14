import {
  Box,
  Button,
  Icon,
  Textarea,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import LayoutContainer from '../../Onboarding/Layout';

const EnterPhrase = () => {
  console.log('EnterPhrase');
  const isVertical = useIsVerticalLayout();
  return (
    <LayoutContainer
      title="Convert Recovery Phrase to  Dotmap for KeyTag"
      secondaryContent={
        !isVertical ? (
          <Box>
            <Icon name="DotsCircleHorizontalOutline" />
            <Typography.Body2Strong>
              What is a recovery phrase?
            </Typography.Body2Strong>
            <Typography.Body2 color="text-subdued">
              It is a 12-, 18 or 24-word phrase that can be used to restore your
              wallet.
            </Typography.Body2>
          </Box>
        ) : undefined
      }
    >
      <Box flex="1">
        <Textarea placeholder="Enter Recovery Phrase" />
        <Button type="primary">Next</Button>
      </Box>
    </LayoutContainer>
  );
};
export default EnterPhrase;
