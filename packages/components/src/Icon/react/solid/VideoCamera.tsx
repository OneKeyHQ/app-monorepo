import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgVideoCamera = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path d="M2 6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6zm12.553 1.106A1 1 0 0 0 14 8v4a1 1 0 0 0 .553.894l2 1A1 1 0 0 0 18 13V7a1 1 0 0 0-1.447-.894l-2 1z" />
  </Svg>
);

export default SvgVideoCamera;
