import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCodeInsert = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 4h5v16h-5v2h-2V2h2z" />
    <Path
      fillRule="evenodd"
      d="M13 20H2V4h11zM5.586 9.5l2.5 2.5-2.5 2.5L7 15.914 10.914 12 7 8.086z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCodeInsert;
