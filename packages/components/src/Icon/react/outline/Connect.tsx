import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgConnect = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
    <Path
      d="M10 8H7a4 4 0 1 0 0 8h3m4-8h3a4 4 0 0 1 0 8h-3m-5-4h6"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

export default SvgConnect;
