import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGiftTopView = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4v16m-8-8h16M8 16c1.648-1.064 2.916-2.363 4-4m0 0c1.084 1.637 2.352 2.936 4 4m-4-4v-1.333M12 12h-1.333A2.667 2.667 0 0 1 8 9.333C8 8.597 8.597 8 9.333 8A2.667 2.667 0 0 1 12 10.667M12 12h1.333A2.667 2.667 0 0 0 16 9.333C16 8.597 15.403 8 14.667 8A2.667 2.667 0 0 0 12 10.667M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgGiftTopView;
