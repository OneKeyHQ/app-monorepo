import { Button, Center, Collapse } from '@onekeyhq/components';

const CollapseGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Collapse trigger="hello">this is a question</Collapse>
    <Collapse trigger="defaultCollapsed" defaultCollapsed={false}>
      this is a question
    </Collapse>
    <Collapse
      renderCustomTrigger={(onPress) => (
        <Button onPress={onPress}>CustonTrigger</Button>
      )}
      onCollapseChange={alert}
    >
      this is another question
    </Collapse>
  </Center>
);

export default CollapseGallery;
