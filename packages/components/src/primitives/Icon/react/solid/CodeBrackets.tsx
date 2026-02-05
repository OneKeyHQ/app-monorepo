import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCodeBrackets = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.155 3.38a.96.96 0 0 1 .699 1.166L11.01 19.92a.96.96 0 1 1-1.864-.466L12.99 4.08a.96.96 0 0 1 1.165-.7m-7.24 4.097a.96.96 0 0 1 0 1.359L3.75 12l3.164 3.164a.96.96 0 0 1-1.359 1.359l-3.164-3.164a1.92 1.92 0 0 1 0-2.718l3.164-3.164a.96.96 0 0 1 1.36 0m10.17 0a.96.96 0 0 1 1.36 0l3.164 3.164c.75.75.75 1.967 0 2.718l-3.164 3.164a.961.961 0 0 1-1.36-1.359L20.25 12l-3.164-3.164a.96.96 0 0 1 0-1.359Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCodeBrackets;
