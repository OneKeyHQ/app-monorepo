import { Button, Page, YStack } from '@onekeyhq/components';
import { useChainSelector } from '@onekeyhq/kit/src/common';

const CommonPage = () => {
  const { select } = useChainSelector();
  return (
    <Page>
      <Page.Body>
        <YStack px="$4" space="1">
          <Button onPress={select}>Select Chain</Button>
        </YStack>
      </Page.Body>
    </Page>
  );
};

export default CommonPage;
