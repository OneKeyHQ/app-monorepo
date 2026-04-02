import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBrokenLink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 23h-2v-3h2zM7.414 11l-3.5 3.5L9.5 20.086l3.5-3.5L14.414 18 9.5 22.914 1.086 14.5 6 9.586zm14.5 9.5L20.5 21.914 18.086 19.5l1.414-1.414zM23 16h-3v-2h3zm-.086-6.5L18 14.414 16.586 13l3.5-3.5L14.5 3.914l-3.5 3.5L9.586 6 14.5 1.086zM4 10H1V8h3zm1.914-5.5L4.5 5.914 2.086 3.5 3.5 2.086zM10 4H8V1h2z" />
  </Svg>
);
export default SvgBrokenLink;
