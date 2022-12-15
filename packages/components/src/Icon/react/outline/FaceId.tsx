import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFaceId = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M15 15s-1 1-3 1-3-1-3-1m7.25-4.746V8.75m-8.5 1.5v-1.5m4.25 0v3c0 .43-.104.5-.5.5h-.75M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SvgFaceId;
