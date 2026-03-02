import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHeadphone = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 3a9 9 0 0 1 9 9v9h-6v-8h4v-1a7 7 0 1 0-14 0v1h4v8H3v-9a9 9 0 0 1 9-9M5 19h2v-4H5zm12 0h2v-4h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHeadphone;
