import { Alert, Center, ScrollView, VStack } from '@onekeyhq/components';

const AlertGallery = () => (
  <ScrollView>
    <Center flex="1" bg="background-hovered" p="4" w="full">
      <VStack maxW="384px" space="3" py="4">
        <Alert
          alertType="warn"
          title="Too long a title needs to be wrapped. Too long a title needs to be wrapped. Too long a title needs to be wrapped."
        />
        <Alert
          dismiss={false}
          alertType="success"
          title="Too long a title needs to be wrapped. Too long a title needs to be wrapped. Too long a title needs to be wrapped."
        />
        <Alert alertType="info" title="Warning" />
        <Alert
          alertType="success"
          title="Warning"
          action="Update firmware"
          actionType="right"
          dismiss={false}
        />
        <Alert
          alertType="warn"
          title="Warning"
          action="Update firmware"
          actionType="right"
        />
        <Alert
          alertType="error"
          title="Warning"
          action="Update firmware"
          actionType="right"
        />
        <Alert
          alertType="info"
          title="Warning"
          action="Update firmware"
          actionType="bottom"
        />
        <Alert
          alertType="success"
          title="Warning"
          action="Update firmware"
          actionType="bottom"
          dismiss={false}
        />
        <Alert
          alertType="warn"
          title="Warning"
          action="Update firmware"
          actionType="bottom"
        />
        <Alert
          alertType="error"
          title="Warning"
          action="Update firmware"
          actionType="bottom"
        />

        <Alert
          dismiss={false}
          alertType="info"
          title="Infomation"
          description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam quo totam eius aperiam dolorum."
        />
        <Alert
          alertType="warn"
          title="Warning"
          description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam quo totam eius aperiam dolorum."
        />

        <Alert
          alertType="error"
          title="Warning"
          description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam quo totam eius aperiam dolorum."
        />
        <Alert
          alertType="success"
          title="Warning"
          description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam quo totam eius aperiam dolorum."
        />
        <Alert
          action="Update firmware"
          actionType="bottom"
          alertType="success"
          title="Warning"
          description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam quo totam eius aperiam dolorum."
        />
        <Alert
          action="Update firmware"
          actionType="right"
          alertType="success"
          title="Warning"
          description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam quo totam eius aperiam dolorum."
        />
      </VStack>
    </Center>
  </ScrollView>
);

export default AlertGallery;
