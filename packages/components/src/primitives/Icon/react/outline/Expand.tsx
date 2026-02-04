import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgExpand = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.8 14.25v4.5h5.4v-4.5zm14.4-.9v-8.1H5.7v4.5a.9.9 0 1 1-1.8 0v-4.5a1.8 1.8 0 0 1 1.8-1.8h13.5a1.8 1.8 0 0 1 1.8 1.8v8.1a1.8 1.8 0 0 1-1.8 1.8h-4.5a.9.9 0 0 1 0-1.8zm-7.2 5.4a1.8 1.8 0 0 1-1.8 1.8H4.8a1.8 1.8 0 0 1-1.8-1.8v-4.5a1.8 1.8 0 0 1 1.8-1.8h5.4a1.8 1.8 0 0 1 1.8 1.8zm5.4-8.1a.9.9 0 0 1-1.8 0v-.527l-1.164 1.163a.9.9 0 1 1-1.272-1.272l1.163-1.164H13.8a.9.9 0 1 1 0-1.8h2.7a.9.9 0 0 1 .9.9z" />
  </Svg>
);
export default SvgExpand;
