import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEthereum = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m11.818 13.728-1.997-.5L12 16.225l2.18-2.997-1.998.5a.749.749 0 0 1-.364 0ZM12 12.227l2.74-.685L12 7.775l-2.74 3.767 2.74.685Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm10.607-5.941a.75.75 0 0 0-1.214 0l-4 5.5a.75.75 0 0 0 0 .882l4 5.5a.75.75 0 0 0 1.214 0l4-5.5a.75.75 0 0 0 0-.882l-4-5.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEthereum;
