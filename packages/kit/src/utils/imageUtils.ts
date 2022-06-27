import { isSVG as isSVGImage } from '@onekeyhq/kit/src/utils/uriUtils';

const ProxyURL = 'https://fiat.onekey.so/image/svg2png?url=';

function svgToPng(url: string) {
  const encoded = encodeURI(url);
  return `${ProxyURL}${encoded}`;
}

export function svgToPngIfNeeded(url?: string | null) {
  if (!url) {
    return '';
  }
  const isSVG = isSVGImage(url);
  return isSVG ? svgToPng(url) : url;
}
