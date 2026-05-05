import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSdCard2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20 22H4V6.586L8.586 2H20zM6 7.414V20h12V4h-2v4h-2V4h-2v4h-2V4h-.586z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSdCard2;
