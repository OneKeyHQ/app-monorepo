import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgCheckCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m9 12 2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
    />
  </Svg>
);

export default SvgCheckCircle;
