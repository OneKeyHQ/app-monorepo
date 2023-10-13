import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFeatures = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m9 16-4 4m2-9-4 4m13 1-4 4m.783-15.076-2.322.538a1 1 0 0 0-.53 1.63l1.563 1.8a1 1 0 0 1 .241.742l-.206 2.374a1 1 0 0 0 1.386 1.007l2.195-.93a1 1 0 0 1 .78 0l2.194.93a1 1 0 0 0 1.387-1.007l-.206-2.374a1 1 0 0 1 .24-.742l1.563-1.8a1 1 0 0 0-.53-1.63l-2.321-.538a1 1 0 0 1-.631-.458l-1.23-2.042a1 1 0 0 0-1.713 0l-1.229 2.042a1 1 0 0 1-.63.458Z"
    />
  </Svg>
);
export default SvgFeatures;
