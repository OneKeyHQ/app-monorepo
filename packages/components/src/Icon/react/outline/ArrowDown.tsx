import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgArrowDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m19 14-7 7m0 0-7-7m7 7V3"
    />
  </Svg>
);

export default SvgArrowDown;
