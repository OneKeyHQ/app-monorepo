import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBank = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M19 9v8m-4 0V9M5 9v8m4 0V9M3.683 6.658l7.423-3.71a2 2 0 0 1 1.788 0l7.423 3.71A1.236 1.236 0 0 1 19.764 9H4.236a1.236 1.236 0 0 1-.553-2.342ZM4.387 20h15.226a1 1 0 0 0 .948-1.316l-.105-.316A2 2 0 0 0 18.558 17H5.442a2 2 0 0 0-1.898 1.368l-.105.316A1 1 0 0 0 4.387 20Z"
    />
  </Svg>
);
export default SvgBank;
