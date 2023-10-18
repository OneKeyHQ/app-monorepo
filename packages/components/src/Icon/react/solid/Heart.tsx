import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHeart = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12.49 21.372c8.527-4.78 10.625-10.47 9.021-14.47-.779-1.941-2.413-3.333-4.341-3.763-1.698-.378-3.553.003-5.17 1.287-1.616-1.284-3.47-1.666-5.169-1.287-1.928.43-3.563 1.822-4.341 3.764-1.605 4 .494 9.69 9.021 14.47a1 1 0 0 0 .978 0Z"
    />
  </Svg>
);
export default SvgHeart;
