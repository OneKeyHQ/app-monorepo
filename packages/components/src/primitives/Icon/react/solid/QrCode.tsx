import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgQrCode = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7 16a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
    <Path
      fillRule="evenodd"
      d="M9 13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zm-4 6h4v-4H5z"
      clipRule="evenodd"
    />
    <Path d="M14 19a1 1 0 1 1 0 2 1 1 0 0 1 0-2M20 17a1 1 0 1 1 0 2h-1v1a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1zM14 13a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1M20 13a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2zM7 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
    <Path
      fillRule="evenodd"
      d="M9 3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 9h4V5H5z"
      clipRule="evenodd"
    />
    <Path d="M17 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
    <Path
      fillRule="evenodd"
      d="M19 3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm-4 6h4V5h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgQrCode;
