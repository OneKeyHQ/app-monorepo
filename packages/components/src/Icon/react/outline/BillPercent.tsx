import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBillPercent = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l2.333-2 2.334 2L12 19l2.333 2 2.334-2L19 21V5Zm-3.75 2.75-6.5 6.5"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0.75}
      d="M9 8.875a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Zm6 6a.875.875 0 1 0 0-1.75.875.875 0 0 0 0 1.75Z"
    />
  </Svg>
);
export default SvgBillPercent;
