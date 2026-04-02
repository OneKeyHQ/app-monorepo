import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCryptopunk = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7 4v2h10V4h2v2h3v2h-3v10h-2v2h-5v2H5v-7H3V9h2V4zm2 11h2v1h4v-2h-3.99v-1H9zm1-6v2h2.01V9zm4 0v2h2.01V9z"
      clipRule="evenodd"
    />
    <Path d="M17 4H7V2h10z" />
  </Svg>
);
export default SvgCryptopunk;
