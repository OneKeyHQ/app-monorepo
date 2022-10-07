import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgFlag = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h10a1 1 0 0 1 .8 1.6L14.25 8l2.55 3.4A1 1 0 0 1 16 13H6a1 1 0 0 0-1 1v3a1 1 0 1 1-2 0V6z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgFlag;
