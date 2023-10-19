import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPlay = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20.245 10.298 9.051 3.384C7.719 2.561 6 3.52 6 5.086v13.828c0 1.566 1.719 2.524 3.051 1.702l11.194-6.914a2 2 0 0 0 0-3.404Z"
    />
  </Svg>
);
export default SvgPlay;
