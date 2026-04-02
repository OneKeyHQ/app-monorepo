import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBrokenLink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 20h2v3h-2zm-6.586-9-3.5 3.5L9.5 20.086l3.5-3.5L14.414 18 9.5 22.914 1.086 14.5 6 9.586zm14.5 9.5L20.5 21.914 18.086 19.5l1.414-1.414zM23 14v2h-3v-2zm-.086-4.5L18 14.414 16.586 13l3.5-3.5L14.5 3.914l-3.5 3.5L9.586 6 14.5 1.086zM4 8v2H1V8zm1.914-3.5L4.5 5.914 2.086 3.5 3.5 2.086zM8 1h2v3H8z" />
  </Svg>
);
export default SvgBrokenLink;
