import { Markdown } from '@onekeyhq/components/src/content/Markdown';

import { Layout } from './utils/Layout';

const content = `
# Heading1

## Heading2

### ✨ New Features
- *Don’t forget your passphrase!*
- **Don’t forget your passphrase!**
- Support for Manta, Neurai, and Nervos networks.
- Support for LNURL Auth authorization signing.
- Ability to view firmware version in device information.
- New precision display under the Celestia network.

### 🐞 Bug Fixes
* Fixed incorrect display of recipient addresses during transfers on Near and Tron networks.
* Fixed overlapping transaction data display in Thorswap routing.
* Fixed incomplete display of signing information on the Sui network.

### 💎 Improvements
- Optimized packet handling logic for signing data on the Sui network.
- Increased blind signature message length to 4096 on the Polkadot network.

### 📝 Markdown Ordered List
1. Fixed incorrect display of recipient addresses during transfers on Near and Tron networks.
1. Fixed overlapping transaction data display in Thorswap routing.
1. Fixed incomplete display of signing information on the Sui network.

### 💡 Markdown UnOrdered List 1
- [ ] Fixed incorrect display of recipient addresses during transfers on Near and Tron networks.
- [ ] Fixed overlapping transaction data display in Thorswap routing.
- [ ] Fixed incomplete display of signing information on the Sui network.

### 💡 Markdown UnOrdered List 2
- Fixed incorrect display of recipient addresses during transfers on Near and Tron networks.
- Fixed overlapping transaction data display in Thorswap routing.
- Fixed incomplete display of signing information on the Sui network.

### 💡 Markdown UnOrdered List 3
* Fixed incorrect display of recipient addresses during transfers on Near and Tron networks.
* Fixed overlapping transaction data display in Thorswap routing.
* Fixed incomplete display of signing information on the Sui network.


`;

const MarkdownGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="Markdown"
    elements={[
      {
        title: 'default',
        element: <Markdown>{content}</Markdown>,
      },
    ]}
  />
);

export default MarkdownGallery;
