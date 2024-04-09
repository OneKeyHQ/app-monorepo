import { Markdown } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const content = `
# Heading1
## Heading2
### ✨ New Features
- Support for Manta, Neurai, and Nervos networks.
- Support for LNURL Auth authorization signing.
- Ability to view firmware version in device information.
- New precision display under the Celestia network.

### 🐞 Bug Fixes
- Fixed incorrect display of recipient addresses during transfers on Near and Tron networks.
- Fixed overlapping transaction data display in Thorswap routing.
- Fixed incomplete display of signing information on the Sui network.

### 💎 Improvements
- Optimized packet handling logic for signing data on the Sui network.
- Increased blind signature message length to 4096 on the Polkadot network.
`;

const MarkdownGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'default',
        element: <Markdown>{content}</Markdown>,
      },
    ]}
  />
);

export default MarkdownGallery;
