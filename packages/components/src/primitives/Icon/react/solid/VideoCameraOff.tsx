import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVideoCameraOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M2.133 1.963a1 1 0 0 1 1.404.17l14.5 18.5a1 1 0 0 1-1.574 1.234l-1.709-2.18q-.242.062-.504.063h-10a2 2 0 0 1-2-2v-12c0-.52.199-.993.524-1.349l-.811-1.034a1 1 0 0 1 .17-1.404" />
    <Path
      fillRule="evenodd"
      d="M14.25 3.75a2 2 0 0 1 2 2v2.382l3.83-1.914a1.5 1.5 0 0 1 2.17 1.34v8.383a1.5 1.5 0 0 1-2.17 1.341l-3.499-1.749L7.346 3.75zm2 6.618v2.764l4 2V8.368z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgVideoCameraOff;
