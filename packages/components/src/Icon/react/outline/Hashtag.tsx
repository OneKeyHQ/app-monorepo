import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgHashtag = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m7 20 4-16m2 16 4-16M6 9h14M4 15h14"
    />
  </Svg>
);

export default SvgHashtag;
