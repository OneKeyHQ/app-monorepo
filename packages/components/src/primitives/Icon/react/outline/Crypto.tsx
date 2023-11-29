import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCrypto = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11.25 7.814a1.5 1.5 0 0 1 1.5 0l2.5 1.444a1.5 1.5 0 0 1 .75 1.299v2.886a1.5 1.5 0 0 1-.75 1.3l-2.5 1.443a1.5 1.5 0 0 1-1.5 0l-2.5-1.444A1.5 1.5 0 0 1 8 13.443v-2.886a1.5 1.5 0 0 1 .75-1.3l2.5-1.443Z"
    />
  </Svg>
);
export default SvgCrypto;
