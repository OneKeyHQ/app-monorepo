import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFileLink = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 2H6a2 2 0 0 0-2 2v5.341A6 6 0 0 1 12 15v3a5.98 5.98 0 0 1-1.528 4H18a2 2 0 0 0 2-2V10h-6a2 2 0 0 1-2-2z" />
    <Path d="M19.414 8 14 2.586V8zM4 15a2 2 0 1 1 4 0 1 1 0 1 0 2 0 4 4 0 0 0-8 0 1 1 0 1 0 2 0" />
    <Path d="M7 16a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0z" />
    <Path d="M4 18a1 1 0 1 0-2 0 4 4 0 0 0 8 0 1 1 0 1 0-2 0 2 2 0 1 1-4 0" />
  </Svg>
);
export default SvgFileLink;
