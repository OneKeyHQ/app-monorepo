import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPound = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.5 6c.951 0 1.815.38 2.445.996l.716.7-1.397 1.43-.716-.7A1.5 1.5 0 0 0 11 9.5c0 .347.096.662.251.999.076.167.16.324.255.502H15v2h-3.127l-.856 2H15v2H7.983l1.715-4H8v-2h1.293A4.1 4.1 0 0 1 9 9.5 3.5 3.5 0 0 1 12.5 6" />
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPound;
