import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEditList = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3.002 4.19c0-.54.438-.978.978-.978h15.643a.978.978 0 1 1 0 1.955H3.98a.98.98 0 0 1-.978-.978Zm0 3.91c0-.54.438-.977.978-.977h6.355a.978.978 0 1 1 0 1.955H3.98a.98.98 0 0 1-.978-.978m.976 2.933a.978.978 0 1 0 0 1.956h2.935a.978.978 0 1 0 0-1.956zM18.205 8.1a1.955 1.955 0 0 0-2.766 0L7.2 16.34a.98.98 0 0 0-.286.692v3.779c0 .54.438.977.977.977h3.78a.98.98 0 0 0 .69-.286l8.24-8.24a1.956 1.956 0 0 0 0-2.766L18.206 8.1Z" />
  </Svg>
);
export default SvgEditList;
