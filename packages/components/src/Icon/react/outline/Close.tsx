import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgClose = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18 18 6M6 6l12 12"
    />
  </Svg>
);

export default SvgClose;
