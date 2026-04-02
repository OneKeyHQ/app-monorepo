import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAddColumn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M18 18h-3v-2h3v-3h2v3h3v2h-3v3h-2z" />
    <Path
      fillRule="evenodd"
      d="M20 6h-7v14H2V4h20v7h-2zM4 18h7V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAddColumn;
