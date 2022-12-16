import { Button, Divider, Empty, ScrollView } from '@onekeyhq/components';

const EmptyGallery = () => (
  <ScrollView bg="background-hovered">
    <Empty
      title="No Projects"
      subTitle="Get started by creating a new project."
      actionTitle="New Project"
      handleAction={() => {}}
    />
    <Divider />
    <Empty
      title="No Projects"
      subTitle="Get started by creating a new project."
    />
    <Divider />
    <Empty
      icon={null}
      title="No Projects"
      subTitle="Get started by creating a new project."
    />
    <Divider />
    <Empty
      icon={null}
      title="No Projects"
      subTitle="Get started by creating a new project."
      actionTitle="New Project"
      handleAction={() => {}}
    />
    <Divider />
    <Empty
      icon={<Button>Icon Button</Button>}
      title="No Projects"
      subTitle="Get started by creating a new project."
      actionTitle="New Project"
      handleAction={() => {}}
    />
  </ScrollView>
);

export default EmptyGallery;
