import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRenew = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 4.582a8 8 0 0 0-6.5 14.614M9 15v5H4"
    />
    <Path
      fill="currentColor"
      d="M13 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8-10a1 1 0 1 0-2 0 1 1 0 0 0 2 0Zm-1.07 3.268a1 1 0 1 1-1 1.732 1 1 0 0 1 1-1.732Zm-2.562 5.026a1 1 0 1 0-1-1.732 1 1 0 0 0 1 1.732ZM18.927 8a1 1 0 1 1-1-1.732 1 1 0 0 1 1 1.732Z"
    />
  </Svg>
);
export default SvgRenew;
