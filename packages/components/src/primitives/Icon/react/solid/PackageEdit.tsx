import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageEdit = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8 9h8V3h5v7.878a4.65 4.65 0 0 0-4.621 1.167L12 16.424V21H3V3h5z" />
    <Path
      fillRule="evenodd"
      d="M17.793 13.46a2.65 2.65 0 1 1 3.747 3.747L17.747 21H14v-3.747zm2.333 1.414a.65.65 0 0 0-.919 0L16 18.081V19h.919l3.207-3.207a.65.65 0 0 0 0-.919"
      clipRule="evenodd"
    />
    <Path d="M14 7h-4V3h4z" />
  </Svg>
);
export default SvgPackageEdit;
