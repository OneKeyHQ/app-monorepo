import { useMemo, useState } from 'react';

import {
  Button,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { PrimeGiftSuccessView } from '@onekeyhq/kit/src/views/Prime/components/PrimeGiftViews';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ONEKEY_API_HOST,
  ONEKEY_TEST_API_HOST,
} from '@onekeyhq/shared/src/config/appConfig';
import type { ILinkConfigItem } from '@onekeyhq/shared/types/linkConfig';
import type { IPrimeGiftClaimResult } from '@onekeyhq/shared/types/prime/primeGiftTypes';

type IPreviewMode = 'live' | 'empty' | 'sample';

const EMPTY_CAMPAIGN_LINKS: ILinkConfigItem[] = [];

const SAMPLE_CAMPAIGN_LINKS: ILinkConfigItem[] = [
  {
    linkId: 'gallery_fixture_sample',
    title: '[Fixture] Campaign title',
    description: '[Fixture] Campaign description',
    mode: 3,
    payload: 'https://onekey.so/',
    image: null,
  },
];

const GALLERY_CLAIM_RESULT: IPrimeGiftClaimResult = {
  serialNo: 'GALLERY',
  giftMonths: 6,
  addedDays: 180,
  finalExpiresAt: Date.UTC(2027, 2, 7),
  onekeyUserId: 'gallery-user',
  email: 'gallery@example.com',
};

function getModeLabel({
  mode,
  usesTestEndpoint,
}: {
  mode: IPreviewMode;
  usesTestEndpoint: boolean;
}) {
  if (mode === 'empty') {
    return 'Fixture · empty';
  }
  if (mode === 'sample') {
    return 'Fixture · sample';
  }
  return usesTestEndpoint
    ? `Live · ${ONEKEY_TEST_API_HOST}`
    : `Live · ${ONEKEY_API_HOST}`;
}

export function Pro2PrimeGiftSuccessBannerPreview() {
  const [mode, setMode] = useState<IPreviewMode>('live');
  const [devSettings] = useDevSettingsPersistAtom();
  const usesTestEndpoint = Boolean(
    devSettings.enabled && devSettings.settings?.enableTestEndpoint,
  );
  const campaignLinksOverride = useMemo(() => {
    if (mode === 'empty') {
      return EMPTY_CAMPAIGN_LINKS;
    }
    if (mode === 'sample') {
      return SAMPLE_CAMPAIGN_LINKS;
    }
    return undefined;
  }, [mode]);
  const modeLabel = getModeLabel({ mode, usesTestEndpoint });

  return (
    <YStack gap="$3">
      <XStack flexWrap="wrap" gap="$2">
        <Button
          size="small"
          variant={mode === 'live' ? 'primary' : 'secondary'}
          onPress={() => setMode('live')}
        >
          Live
        </Button>
        <Button
          size="small"
          variant={mode === 'empty' ? 'primary' : 'secondary'}
          onPress={() => setMode('empty')}
        >
          Fixture empty
        </Button>
        <Button
          size="small"
          variant={mode === 'sample' ? 'primary' : 'secondary'}
          onPress={() => setMode('sample')}
        >
          Fixture sample
        </Button>
      </XStack>
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        testID="prime-gift-banner-mode-label"
      >
        {modeLabel}. Live uses the Developer API environment selector.
      </SizableText>
      <YStack
        height={640}
        borderWidth={1}
        borderColor="$borderSubdued"
        borderRadius="$4"
        overflow="hidden"
      >
        <PrimeGiftSuccessView
          result={GALLERY_CLAIM_RESULT}
          isKytEnabled={false}
          isKytLoading={false}
          onKyt={() => {}}
          onEnterWallet={() => {
            Toast.message({ title: 'Enter wallet (gallery)' });
          }}
          campaignLinksOverride={campaignLinksOverride}
        />
      </YStack>
    </YStack>
  );
}
