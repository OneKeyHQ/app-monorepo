import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLock = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 10V7a4 4 0 0 0-8 0v3m4 4v3m-5 4h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgLock;
