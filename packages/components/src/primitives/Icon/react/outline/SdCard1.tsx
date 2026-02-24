import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSdCard1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 10H8V6h2zm4 0h-2V6h2z" />
    <Path
      fillRule="evenodd"
      d="m18 7.697 2 3V22H4V2h14zM6 20h12v-8.697l-2-3V4H6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSdCard1;
