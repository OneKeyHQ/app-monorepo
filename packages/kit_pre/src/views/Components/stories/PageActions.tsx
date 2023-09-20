import { Center, PageActions } from '@onekeyhq/components';

const PageActionsGallery = () => (
  <Center flex="1" bg="background-hovered">
    <PageActions primaryButton="confirm" secondaryButton="cancel" />
    <PageActions primaryButton="confirm" />
    <PageActions
      primaryButton="confirm"
      title="Total"
      content="2 UNI"
      moreContent="FEE:0.00001"
    />
    <PageActions
      secondaryButton="cancel"
      primaryButton="confirm"
      title="Total"
      content="2 UNI"
      moreContent="FEE:0.00001"
    />
  </Center>
);

export default PageActionsGallery;
