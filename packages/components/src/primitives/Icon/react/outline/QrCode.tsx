import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgQrCode = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9 13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zm-4 6h4v-4H5z"
      clipRule="evenodd"
    />
    <Path d="M14 18.99a1 1 0 0 1 1 1V20a1 1 0 1 1-2 0v-.01a1 1 0 0 1 1-1M20 17a1 1 0 1 1 0 2h-1v1a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1zM14 13a1 1 0 0 1 1 1v1h1a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1M20 13a1 1 0 1 1 0 2h-2a1 1 0 1 1 0-2z" />
    <Path
      fillRule="evenodd"
      d="M9 3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 9h4V5H5zM19 3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm-4 6h4V5h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgQrCode;
