import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLayerBehind = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20 7.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2zm-16 11h16v-9H4z"
      clipRule="evenodd"
    />
    <Path d="M19 3.5a1 1 0 1 1 0 2H5a1 1 0 0 1 0-2z" />
  </Svg>
);
export default SvgLayerBehind;
