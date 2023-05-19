import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgActivity = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="none" accessibilityRole="image" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7.5 2a1 1 0 0 1 .942.664L12.5 14.027l1.558-4.363A1 1 0 0 1 15 9h3a1 1 0 1 1 0 2h-2.295l-2.263 6.336a1 1 0 0 1-1.884 0L7.5 5.973l-1.558 4.363A1 1 0 0 1 5 11H2a1 1 0 1 1 0-2h2.295l2.263-6.336A1 1 0 0 1 7.5 2Z"
      fill="#8C8CA1"
    />
  </Svg>
);
export default SvgActivity;
