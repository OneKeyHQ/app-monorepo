import { useEffect, useState } from 'react';

import { useFonts } from 'expo-font';

const roobertFontConfigs = [
  { src: require('../fonts/Roobert-Regular.ttf'), weight: '400' as const },
  { src: require('../fonts/Roobert-Medium.ttf'), weight: '500' as const },
  { src: require('../fonts/Roobert-SemiBold.ttf'), weight: '600' as const },
  { src: require('../fonts/Roobert-Bold.ttf'), weight: '700' as const },
];

const monoFonts = {
  'GeistMono-Medium': require('../fonts/GeistMono-Medium.ttf'),
  'GeistMono-Regular': require('../fonts/GeistMono-Regular.ttf'),
};

let loadPromise: Promise<void> | null = null;

// App-wide tabular figures (see utils/tabularNums.ts). SizableText already
// defaults this, but text rendered outside the wrapper (raw tamagui Text,
// Badge.Text, portals) inherits it from body via this rule on web.
let numericStyleInjected = false;
function injectGlobalNumericStyle() {
  if (numericStyleInjected) return;
  numericStyleInjected = true;
  const style = document.createElement('style');
  style.textContent = 'body{font-variant-numeric:tabular-nums}';
  document.head.appendChild(style);
}

function loadRoobertFonts() {
  if (!loadPromise) {
    loadPromise = (async () => {
      const faces = roobertFontConfigs.map(
        ({ src, weight }) => new FontFace('Roobert', `url(${src})`, { weight }),
      );
      await Promise.all(faces.map((f) => f.load()));
      faces.forEach((f) => document.fonts.add(f));
    })();
  }
  return loadPromise;
}

export default function useLoadCustomFonts(): [boolean, Error | null] {
  const [monoLoaded, monoError] = useFonts(monoFonts);
  const [rLoaded, setRLoaded] = useState(false);
  const [rError, setRError] = useState<Error | null>(null);

  useEffect(() => {
    injectGlobalNumericStyle();
    loadRoobertFonts()
      .then(() => setRLoaded(true))
      .catch((err) =>
        setRError(err instanceof Error ? err : new Error(String(err))),
      );
  }, []);

  return [monoLoaded && rLoaded, monoError || rError];
}
