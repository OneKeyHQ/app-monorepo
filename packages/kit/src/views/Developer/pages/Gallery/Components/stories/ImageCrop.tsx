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
              const data = await ImageCrop.openPicker({
                width: 300,
                height: 400,
              });
              console.log('cropImage:', data);
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
