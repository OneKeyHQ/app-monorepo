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
                width: 100,
                height: 100,
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
