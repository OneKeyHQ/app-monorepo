import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgChevronRight = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m9 5 7 7-7 7"
    />
  </Svg>
);

export default SvgChevronRight;
