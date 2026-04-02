import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAltText = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 18H6v-2h7zm5 0h-4v-2h4z" />
    <Path
      fillRule="evenodd"
      d="M15.5 6a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5m0 2a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M21 21H3V3h18zM5 19h14v-4H5zm0-6.586V13h6.586L8 9.414zm0-2.828 3-3L14.414 13H19V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAltText;
