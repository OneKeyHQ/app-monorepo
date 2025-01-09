import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTargetArrow = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 12a9 9 0 1 1-9-9m4.771 10.5A5.002 5.002 0 0 1 7 12a5.002 5.002 0 0 1 3.5-4.771M14 10h3.172a2 2 0 0 0 1.414-.586l2.628-2.628a.25.25 0 0 0-.098-.414L18.5 5.5l-.872-2.616a.25.25 0 0 0-.414-.098l-2.628 2.628A2 2 0 0 0 14 6.83V10Zm0 0-2 2"
    />
  </Svg>
);
export default SvgTargetArrow;
