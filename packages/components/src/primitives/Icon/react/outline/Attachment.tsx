import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAttachment = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="m12.206 10.798-4.978 4.98A1.41 1.41 0 0 0 9.22 17.77l9.956-9.96A2.8 2.8 0 0 0 20 5.816a2.8 2.8 0 0 0-.825-1.992A2.8 2.8 0 0 0 17.185 3c-.722 0-1.442.275-1.992.825l-9.956 9.96A4.21 4.21 0 0 0 4 16.776c0 1.08.412 2.162 1.237 2.987A4.2 4.2 0 0 0 8.224 21a4.2 4.2 0 0 0 2.987-1.238l4.978-4.98"
    />
  </Svg>
);
export default SvgAttachment;
