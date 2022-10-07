import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgBell = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6zm0 16a3 3 0 0 1-3-3h6a3 3 0 0 1-3 3z" />
  </Svg>
);

export default SvgBell;
