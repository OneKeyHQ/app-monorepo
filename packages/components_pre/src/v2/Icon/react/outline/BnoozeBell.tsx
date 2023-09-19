import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgBnoozeBell = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m18.3 8.993-1 .05 1-.05Zm-12.6 0 1 .05-1-.05Zm-1.615 6.836.895.447-.895-.447Zm14.394-3.248-.999.05.999-.05Zm-12.958 0-.999-.05.999.05Zm-.209.794-.894-.447.894.447ZM10.5 7.5a1 1 0 0 0 0 2v-2Zm3 1 .8.6a1 1 0 0 0-.8-1.6v1Zm-3 4-.8-.6a1 1 0 0 0 .8 1.6v-1Zm3 1a1 1 0 1 0 0-2v2ZM15 17a3 3 0 0 1-3 3v2a5 5 0 0 0 5-5h-2Zm-3 3a3 3 0 0 1-3-3H7a5 5 0 0 0 5 5v-2Zm-7.191-2h14.382v-2H4.809v2Zm16-2.618-1.227-2.454-1.789.895 1.227 2.453 1.789-.894Zm-1.331-2.851-.18-3.588-1.997.1.18 3.588 1.997-.1ZM4.702 8.943l-.18 3.588 1.998.1.18-3.589-1.998-.1Zm-.284 3.985L3.19 15.382l1.789.894 1.227-2.453-1.79-.895ZM12 2a7.307 7.307 0 0 0-7.298 6.943l1.997.1A5.307 5.307 0 0 1 12 4V2Zm7.298 6.943A7.308 7.308 0 0 0 12 2v2a5.308 5.308 0 0 1 5.3 5.042l1.998-.1ZM3.191 15.382a1.809 1.809 0 0 0-.191.809h2a.19.19 0 0 1-.02.085l-1.789-.894Zm16.391-2.454a1 1 0 0 1-.104-.397l-1.998.1c.021.414.128.82.313 1.192l1.79-.895ZM21 16.191c0-.28-.065-.558-.191-.809l-1.789.894a.19.19 0 0 1-.02-.085h2Zm-16.478-3.66a1 1 0 0 1-.104.397l1.789.895a3 3 0 0 0 .313-1.192l-1.998-.1ZM19.191 18c1 0 1.809-.81 1.809-1.809h-2c0-.105.085-.191.191-.191v2ZM4.809 16c.105 0 .191.085.191.191H3c0 1 .81 1.809 1.809 1.809v-2ZM10.5 9.5h3v-2h-3v2Zm2.2-1.6-3 4 1.6 1.2 3-4-1.6-1.2Zm-2.2 5.6h3v-2h-3v2Z"
    />
  </Svg>
);
export default SvgBnoozeBell;
