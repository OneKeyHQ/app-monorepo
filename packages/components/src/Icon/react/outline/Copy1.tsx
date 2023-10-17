import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCopy1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 9V4.25C15 3.56 14.44 3 13.75 3h-9.5C3.56 3 3 3.56 3 4.25v9.5c0 .69.56 1.25 1.25 1.25H9m1.25-6h9.5c.69 0 1.25.56 1.25 1.25v9.5c0 .69-.56 1.25-1.25 1.25h-9.5C9.56 21 9 20.44 9 19.75v-9.5C9 9.56 9.56 9 10.25 9Z"
    />
  </Svg>
);
export default SvgCopy1;
