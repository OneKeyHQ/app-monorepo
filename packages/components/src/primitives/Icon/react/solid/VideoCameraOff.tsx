import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoCameraOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m18.405 21.67-1.574 1.234L14.556 20H2.002V4h.013l-.917-1.17 1.574-1.234z" />
    <Path
      fillRule="evenodd"
      d="M16.002 4v4.382l6-3v13.236l-5.669-2.834L7.098 4zm0 6.618v2.764l4 2V8.618z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoCameraOff;
