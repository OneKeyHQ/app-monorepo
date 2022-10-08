import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgUser = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-7 9a7 7 0 1 1 14 0H3z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgUser;
