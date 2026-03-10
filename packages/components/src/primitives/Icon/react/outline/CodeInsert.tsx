import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCodeInsert = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17 4h5v16h-5v2h-2V2h2zm0 14h3V6h-3z"
      clipRule="evenodd"
    />
    <Path d="M13 6H4v12h9v2H2V4h11z" />
    <Path d="M11.914 12 8 15.914 6.586 14.5l2.5-2.5-2.5-2.5L8 8.086z" />
  </Svg>
);
export default SvgCodeInsert;
