import { Layout } from '../utils/Layout';

const PlaygroundGallery = () => (
  <Layout
    componentName="Playground"
    getFilePath={() => __CURRENT_FILE_PATH__}
    elements={[]}
  />
);

export default PlaygroundGallery;
