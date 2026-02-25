import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCompass = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="m17.962 17.274-.153.535-.535.153-15.73 4.494 4.494-15.73.153-.535.535-.153 15.73-4.494zM7.809 7.81 4.456 19.543 16.19 16.19l3.353-11.734z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCompass;
