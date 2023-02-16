import { Alert, ScrollView, VStack } from '@onekeyhq/components';

const AlertGallery = () => (
  <ScrollView>
    <VStack maxW="384px" space="3" p="4" bgColor="background-default">
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
        action="Update"
        dismiss={false}
      />
      <Alert alertType="warn" title="Warning" action="Update" />
      <Alert alertType="error" title="Warning" action="Update" />
      <Alert alertType="info" title="Warning" action="Update" />
      <Alert
        alertType="success"
        title="Warning"
        action="Update"
        dismiss={false}
      />
      <Alert alertType="warn" title="Warning" action="Update" />
      <Alert alertType="error" title="Warning" action="Update" />

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
        action="Update"
        alertType="success"
        title="Warning"
        description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam quo totam eius aperiam dolorum."
      />
      <Alert
        action="Update"
        alertType="success"
        title="Warning"
        description="Lorem ipsum dolor sit amet consectetur adipisicing elit. Aliquid pariatur, ipsum similique veniam quo totam eius aperiam dolorum."
      />
    </VStack>
  </ScrollView>
);

export default AlertGallery;
