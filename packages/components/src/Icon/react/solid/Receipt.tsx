import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgReceipt = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 2a3 3 0 0 0-3 3v14.388a1.5 1.5 0 0 0 2.244 1.303l2.287-1.307 2.575 1.287a2 2 0 0 0 1.788 0l2.575-1.287 2.287 1.307A1.5 1.5 0 0 0 20 19.388V5a3 3 0 0 0-3-3H7Zm2 12a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1Zm5.457-5.743a1 1 0 0 0-1.414-1.414L11.3 8.586l-.343-.343a1 1 0 0 0-1.414 1.414l1.05 1.05a1 1 0 0 0 1.414 0l2.45-2.45Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgReceipt;
