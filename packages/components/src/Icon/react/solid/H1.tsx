import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgH1 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 4a1 1 0 0 1 1 1v6h8V5a1 1 0 1 1 2 0v14a1 1 0 1 1-2 0v-6H4v6a1 1 0 1 1-2 0V5a1 1 0 0 1 1-1Zm18.424 6.094A1 1 0 0 1 22 11v8a1 1 0 1 1-2 0v-5.865l-1.36 1.133a1 1 0 1 1-1.28-1.536l3-2.5a1 1 0 0 1 1.064-.138Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgH1;
