import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAtSign = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M16.737 19.654A9 9 0 1 1 21 12c0 1.926-.957 3.915-3.19 3.713a3.222 3.222 0 0 1-2.898-3.665l.515-3.548m-.569 3.967c-.299 2.129-2.051 3.642-3.914 3.38-1.862-.261-3.13-2.199-2.83-4.327.299-2.129 2.051-3.642 3.913-3.38 1.863.261 3.13 2.199 2.831 4.327Z"
    />
  </Svg>
);
export default SvgAtSign;
