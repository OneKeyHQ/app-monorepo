import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCall = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.123 5.996c.901 7.24 6.64 12.98 13.881 13.88C19.1 20.014 20 19.106 20 18v-1.312a2 2 0 0 0-1.425-1.916l-2.003-.6a1 1 0 0 0-.994.25l-.26.26c-.604.604-1.533.77-2.255.315a13.068 13.068 0 0 1-4.06-4.06c-.456-.722-.29-1.65.314-2.254l.26-.26a1 1 0 0 0 .251-.995l-.6-2.003A2 2 0 0 0 7.312 4H6c-1.105 0-2.013.9-1.877 1.996Z"
    />
  </Svg>
);
export default SvgCall;
