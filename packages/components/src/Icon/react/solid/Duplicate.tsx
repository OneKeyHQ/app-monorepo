import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgDuplicate = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path d="M7 9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9z" />
    <Path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2V5h8a2 2 0 0 0-2-2H5z" />
  </Svg>
);

export default SvgDuplicate;
