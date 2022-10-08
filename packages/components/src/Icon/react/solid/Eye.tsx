import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgEye = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path d="M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    <Path
      fillRule="evenodd"
      d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgEye;
