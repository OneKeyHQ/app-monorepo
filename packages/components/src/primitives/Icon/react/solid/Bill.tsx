import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBill = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v16a1 1 0 0 1-1.65.76l-1.683-1.443-1.683 1.442a1 1 0 0 1-1.302 0L12 20.317l-1.682 1.442a1 1 0 0 1-1.302 0l-1.683-1.442-1.682 1.442A1 1 0 0 1 4 21V5Zm4 3a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBill;
