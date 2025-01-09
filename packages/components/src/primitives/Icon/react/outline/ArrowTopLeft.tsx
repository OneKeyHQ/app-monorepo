import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowTopLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.5 17.5 6.75 6.75M15 6H8a2 2 0 0 0-2 2v7"
    />
  </Svg>
);
export default SvgArrowTopLeft;
