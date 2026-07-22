import fs from 'fs';

import { generateUploadNFTParams } from './nftUtils';

import type { INFTMetaData } from '../../types/nft';

describe('nftUtils', () => {
  it('uses the NFT hardware wire type without a runtime transport import', async () => {
    const params = await generateUploadNFTParams({
      blurScreenHex: '03',
      metadata: {} as INFTMetaData,
      screenHex: '01',
      thumbnailHex: '02',
    });
    const source = fs.readFileSync(__filename.replace(/\.test\.ts$/, '.ts'));

    expect(params.resType).toBe(1);
    expect(source.toString()).not.toMatch(
      /import\s+\{\s*ResourceType\s*\}\s+from\s+['"]@onekeyfe\/hd-transport['"]/,
    );
  });
});
