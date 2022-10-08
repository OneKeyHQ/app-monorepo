import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgCheck = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m5 13 4 4L19 7"
    />
  </Svg>
);

export default SvgCheck;
