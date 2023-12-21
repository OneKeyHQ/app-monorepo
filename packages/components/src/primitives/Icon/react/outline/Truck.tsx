import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTruck = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 16h4M9 7v7m0-7H6.07a2 2 0 0 0-1.664.89l-1.07 1.606A2 2 0 0 0 3 10.606v3.68C3 15.233 3.768 16 4.714 16M9 7v2m0-2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2m-9 .5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm9 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
    />
  </Svg>
);
export default SvgTruck;
