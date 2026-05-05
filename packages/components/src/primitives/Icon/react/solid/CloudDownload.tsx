import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudDownload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 4a7 7 0 0 1 6.941 6.089A5.001 5.001 0 0 1 18 20H7A6 6 0 0 1 5.599 8.165 7 7 0 0 1 12 4m-1 4v5.086l-1.5-1.5L8.086 13 12 16.914 15.914 13 14.5 11.586l-1.5 1.5V8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloudDownload;
