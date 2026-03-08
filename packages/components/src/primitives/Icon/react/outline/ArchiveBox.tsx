import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArchiveBox = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M13 14H7v-2h6z" />
    <Path
      fillRule="evenodd"
      d="M12.914 4H19v4h2v13H3V8h2V2h5.914zM5 19h14v-9H5zM7 8h10V6h-4.914l-2-2H7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArchiveBox;
