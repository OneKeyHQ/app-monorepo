import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgMinusCircle = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM7 9a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H7z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgMinusCircle;
