import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowSmallLeft = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" {...props}>
    <Path
      fillRule="evenodd"
      d="M15 10a.75.75 0 0 1-.75.75H7.612l2.158 1.96a.75.75 0 1 1-1.04 1.08l-3.5-3.25a.75.75 0 0 1 0-1.08l3.5-3.25a.75.75 0 1 1 1.04 1.08L7.612 9.25h6.638A.75.75 0 0 1 15 10z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowSmallLeft;
