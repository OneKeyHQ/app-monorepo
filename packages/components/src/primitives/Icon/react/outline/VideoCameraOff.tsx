import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoCameraOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m17.904 21.67-1.574 1.234L14.054 20H2V4.621L.596 2.831 2.17 1.595zM4 18h8.486L4 7.173zm12-9.618 6-3v13.236l-8-4V6H8V4h8zm0 2.236v2.764l4 2V8.618z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoCameraOff;
