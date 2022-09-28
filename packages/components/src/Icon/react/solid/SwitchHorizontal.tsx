import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgSwitchHorizontal = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path d="M8 5a1 1 0 1 0 0 2h5.586l-1.293 1.293a1 1 0 0 0 1.414 1.414l3-3a1 1 0 0 0 0-1.414l-3-3a1 1 0 1 0-1.414 1.414L13.586 5H8zm4 10a1 1 0 1 0 0-2H6.414l1.293-1.293a1 1 0 1 0-1.414-1.414l-3 3a1 1 0 0 0 0 1.414l3 3a1 1 0 0 0 1.414-1.414L6.414 15H12z" />
  </Svg>
);

export default SvgSwitchHorizontal;
