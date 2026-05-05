import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMultiMedia = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.25 5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
    <Path
      fillRule="evenodd"
      d="M16 2v6h6v14H8v-6H2V2zm-3 16 5-3-5-3zm-9-7.87 2-1.332 2 1.333V8h6V4H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMultiMedia;
