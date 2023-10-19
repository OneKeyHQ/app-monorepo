import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgThumbUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 11H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h3m0-9v9m0-9 4-8h.616a2 2 0 0 1 1.976 2.308L13.016 9h5.047a3 3 0 0 1 2.973 3.405l-.682 5A3 3 0 0 1 17.38 20H7"
    />
  </Svg>
);
export default SvgThumbUp;
