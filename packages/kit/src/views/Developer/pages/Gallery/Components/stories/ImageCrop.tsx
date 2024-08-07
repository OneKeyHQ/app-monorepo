import { Button, ImageCrop } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ImageCropGallery = () => (
  <Layout
    description=""
    suggestions={['']}
    boundaryConditions={['']}
    elements={[
      {
        title: 'Default',
        element: (
          <Button
            onPress={async () => {
              const base64String = await ImageCrop.openPicker({
                width: 300,
                height: 400,
              });
              console.log(base64String);
            }}
          >
            open image crop picker
          </Button>
        ),
      },
    ]}
  />
);

export default ImageCropGallery;
