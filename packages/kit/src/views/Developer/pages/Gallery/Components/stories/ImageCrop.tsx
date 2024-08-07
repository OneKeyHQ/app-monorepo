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
                width: 500,
                height: 500,
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
