import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgClockAlert = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M1.293 4.543a1 1 0 0 0 1.414 1.414l3-3a1 1 0 0 0-1.414-1.414l-3 3Zm18.414-3a1 1 0 1 0-1.414 1.414l3 3a1 1 0 1 0 1.414-1.414l-3-3Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10ZM12 7a1 1 0 0 1 1 1v3.586l2.207 2.207a1 1 0 0 1-1.414 1.414l-2.5-2.5A1 1 0 0 1 11 12V8a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgClockAlert;
