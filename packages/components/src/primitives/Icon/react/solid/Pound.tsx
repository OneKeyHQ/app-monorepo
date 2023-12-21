import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPound = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm9-2.5a1.5 1.5 0 0 1 2.548-1.073 1 1 0 1 0 1.398-1.43A3.5 3.5 0 0 0 9 9.5c0 .576.13 1.078.292 1.499H9a1 1 0 1 0 0 2h.563l-1.431 2.504A1 1 0 0 0 9 17h5a1 1 0 1 0 0-2h-3.277l1.143-2H14a1 1 0 1 0 0-2h-2.494l-.027-.05c-.033-.062-.064-.12-.09-.173-.233-.45-.389-.835-.389-1.277Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPound;
