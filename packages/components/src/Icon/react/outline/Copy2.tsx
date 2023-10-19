import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCopy2 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 8v1m5-6h2m5 5v2m-5 5h-1m4-12a2 2 0 0 1 2 2m0 8a2 2 0 0 1-2 2M9 5a2 2 0 0 1 2-2m2.75 6h-9.5C3.56 9 3 9.56 3 10.25v9.5c0 .69.56 1.25 1.25 1.25h9.5c.69 0 1.25-.56 1.25-1.25v-9.5C15 9.56 14.44 9 13.75 9Z"
    />
  </Svg>
);
export default SvgCopy2;
