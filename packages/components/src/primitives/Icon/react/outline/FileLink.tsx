import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileLink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 18a2 2 0 1 0 4 0v-1h2v1a4 4 0 1 1-8 0v-1h2z" />
    <Path
      fillRule="evenodd"
      d="M20 8.586V22h-8.5v-2H18V10h-6V4H6v5H4V2h9.414zM14 8h2.586L14 5.414z"
      clipRule="evenodd"
    />
    <Path d="M7 18H5v-3h2z" />
    <Path d="M6 11a4 4 0 0 1 4 4v1H8v-1a2 2 0 1 0-4 0v1H2v-1a4 4 0 0 1 4-4" />
  </Svg>
);
export default SvgFileLink;
