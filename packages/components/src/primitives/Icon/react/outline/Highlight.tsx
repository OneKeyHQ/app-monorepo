import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHighlight = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.414 7.5 7.914 22H2v-5.914l14.5-14.5zM4 16.914V20h3.086l12.5-12.5L16.5 4.414z"
      clipRule="evenodd"
    />
    <Path d="M22 22h-9v-2h9z" />
  </Svg>
);
export default SvgHighlight;
