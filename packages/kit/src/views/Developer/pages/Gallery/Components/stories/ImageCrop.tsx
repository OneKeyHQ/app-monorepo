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
            onPress={() =>
              ImageCrop.openPicker({
                width: 300,
                height: 400,
                cropping: true,
              })
            }
          >
            open image crop picker
          </Button>
        ),
      },
    ]}
  />
);

export default ImageCropGallery;
