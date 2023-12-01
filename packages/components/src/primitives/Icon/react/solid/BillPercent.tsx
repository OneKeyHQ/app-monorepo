import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBillPercent = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 2a3 3 0 0 0-3 3v16a1 1 0 0 0 1.65.76l1.683-1.443 1.683 1.442a1 1 0 0 0 1.302 0L12 20.317l1.682 1.442a1 1 0 0 0 1.302 0l1.683-1.442 1.682 1.442A1 1 0 0 0 20 21V5a3 3 0 0 0-3-3H7Zm8.957 5.043a1 1 0 0 1 0 1.414l-6.5 6.5a1 1 0 0 1-1.414-1.414l6.5-6.5a1 1 0 0 1 1.414 0ZM10.25 8a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM15 15.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBillPercent;
