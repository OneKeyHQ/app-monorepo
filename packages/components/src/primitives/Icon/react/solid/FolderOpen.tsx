import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderOpen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3.983 3.073A1.983 1.983 0 0 0 2 5.056v12.888c0 1.095.888 1.983 1.983 1.983h15.366a.99.99 0 0 0 .947-.696l2.277-7.287a1.487 1.487 0 0 0-1.42-1.931h-.316V8.03a1.983 1.983 0 0 0-1.983-1.983h-6.41l-1.394-2.09a1.98 1.98 0 0 0-1.65-.884zm14.87 6.94V8.03h-6.939a.99.99 0 0 1-.825-.441L9.401 5.056H3.983v12.888h.758l2.044-6.54a1.98 1.98 0 0 1 1.892-1.391z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFolderOpen;
