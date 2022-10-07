import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgSave = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path d="M7.707 10.293a1 1 0 1 0-1.414 1.414l3 3a1 1 0 0 0 1.414 0l3-3a1 1 0 0 0-1.414-1.414L11 11.586V6h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5v5.586l-1.293-1.293zM9 4a1 1 0 0 1 2 0v2H9V4z" />
  </Svg>
);

export default SvgSave;
