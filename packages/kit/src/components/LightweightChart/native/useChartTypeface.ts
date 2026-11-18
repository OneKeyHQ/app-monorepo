// cspell:ignore Skia
import { useEffect, useState } from 'react';

import { Skia } from '@shopify/react-native-skia';
import { Image } from 'react-native';

import type { SkTypeface } from '@shopify/react-native-skia';

const FONT_SOURCE =
  require('@onekeyhq/components/src/hocs/Provider/fonts/brand/BrandSans-Regular.ttf') as number;
const FONT_URI = Image.resolveAssetSource(FONT_SOURCE)?.uri;

// Keep the native face in the UI runtime so remounts do not swap fonts again.
let chartTypeface: SkTypeface | null = null;
let chartTypefaceRequest: Promise<SkTypeface | null> | undefined;

function loadChartTypeface() {
  if (!chartTypefaceRequest && FONT_URI) {
    chartTypefaceRequest = Skia.Data.fromURI(FONT_URI)
      .then((data) => {
        chartTypeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
        if (!chartTypeface) chartTypefaceRequest = undefined;
        return chartTypeface;
      })
      .catch(() => {
        chartTypefaceRequest = undefined;
        return null;
      });
  }
  return chartTypefaceRequest;
}

export function useChartTypeface() {
  const [typeface, setTypeface] = useState(chartTypeface);
  useEffect(() => {
    let mounted = true;
    if (chartTypeface) setTypeface(chartTypeface);
    else {
      void loadChartTypeface()?.then((face) => {
        if (mounted) setTypeface(face);
      });
    }
    return () => {
      mounted = false;
    };
  }, []);
  return typeface;
}
