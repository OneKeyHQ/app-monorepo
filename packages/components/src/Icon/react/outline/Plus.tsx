import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgPlus = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4v16m8-8H4"
    />
  </Svg>
);

export default SvgPlus;
