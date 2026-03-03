import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPackageEdit = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 3v8h-2V5h-3v5H8V5H5v14h7v2H3V3zM10 8h4V5h-4z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M17.793 13.46a2.65 2.65 0 1 1 3.747 3.747L17.747 21H14v-3.747zm2.333 1.414a.65.65 0 0 0-.919 0L16 18.081V19h.919l3.207-3.207a.65.65 0 0 0 0-.919"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPackageEdit;
