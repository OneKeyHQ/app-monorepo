import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCut = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 3a4 4 0 1 0 2.668 6.98l3.03 2.02-3.03 2.02a4 4 0 1 0 1.11 1.663l12.609-8.406a2 2 0 0 0-2.774-.554L13.5 10.798 9.778 8.317A4 4 0 0 0 6 3ZM4 7a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm0 10a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="m19.613 17.277-5.212-3.474 1.803-1.202 6.183 4.122a2 2 0 0 1-2.774.554Z"
    />
  </Svg>
);
export default SvgCut;
