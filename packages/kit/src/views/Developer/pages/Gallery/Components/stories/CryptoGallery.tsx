import { SizableText, Stack } from '@onekeyhq/components';
import { AppCryptoTestEmoji } from '@onekeyhq/shared/src/appCrypto/utils';

import { AdaAddressPerfTest } from './CryptoGallery/AdaAddressPerfTest';
import { AESGcmV2Test } from './CryptoGallery/AesGcmV2Test';
import {
  AESCbcTest,
  HashTest,
  KeyGenTest,
  PBKDF2Test,
} from './CryptoGallery/BasicCryptoTests';
import { CryptoSubtlePolyfillTest } from './CryptoGallery/CryptoSubtlePolyfillTest';
import { JotaiDemoPriceInfo } from './CryptoGallery/JotaiDemoPriceInfo';
import { NativeWebEmbedCryptoPerfTest } from './CryptoGallery/NativeWebEmbedCryptoPerfTest';
import { SecretFunctionsTest } from './CryptoGallery/SecretFunctionsTest';
import { CustomAccordion, CustomAccordionItem } from './CryptoGallery/shared';
import { Layout } from './utils/Layout';

const CryptoGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="Crypto"
    elements={[
      {
        title: 'Default',
        element: (
          <Stack>
            <SizableText mb="$4" size="$bodyMd">
              {JSON.stringify(AppCryptoTestEmoji, null, 2)}
            </SizableText>
            <CustomAccordion>
              <CustomAccordionItem title="AES-GCM PBKDF2 (v2 test)">
                <AESGcmV2Test />
              </CustomAccordionItem>
              <CustomAccordionItem title="ADA Address Perf">
                <AdaAddressPerfTest />
              </CustomAccordionItem>
              <CustomAccordionItem title="Secret Functions Crypto Perf (v2 test)">
                <NativeWebEmbedCryptoPerfTest />
              </CustomAccordionItem>
              <CustomAccordionItem title="PBKDF2 Test">
                <PBKDF2Test />
              </CustomAccordionItem>
              <CustomAccordionItem title="KeyGen Test">
                <KeyGenTest />
              </CustomAccordionItem>
              <CustomAccordionItem title="Hash Test">
                <HashTest />
              </CustomAccordionItem>
              <CustomAccordionItem title="AES-CBC Test">
                <AESCbcTest />
              </CustomAccordionItem>
              <CustomAccordionItem title="crypto.subtle Polyfill Test">
                <CryptoSubtlePolyfillTest />
              </CustomAccordionItem>
              <CustomAccordionItem title="SecretFunctions Test">
                <SecretFunctionsTest />
              </CustomAccordionItem>
            </CustomAccordion>
            <JotaiDemoPriceInfo />
          </Stack>
        ),
      },
    ]}
  />
);

export default CryptoGallery;
