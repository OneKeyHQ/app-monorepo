import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSettings = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m7.99 5.398-.685-.158A1.722 1.722 0 0 0 5.24 7.305l.158.684a1.946 1.946 0 0 1-.817 2.057l-.832.555a1.682 1.682 0 0 0 0 2.798l.832.555c.673.449.999 1.268.817 2.057l-.158.684a1.722 1.722 0 0 0 2.065 2.065l.684-.158a1.946 1.946 0 0 1 2.057.817l.555.832a1.682 1.682 0 0 0 2.798 0l.555-.832a1.946 1.946 0 0 1 2.057-.817l.684.158a1.722 1.722 0 0 0 2.065-2.065l-.158-.684a1.946 1.946 0 0 1 .817-2.057l.832-.555a1.682 1.682 0 0 0 0-2.798l-.832-.555a1.946 1.946 0 0 1-.817-2.057l.158-.684a1.722 1.722 0 0 0-2.065-2.065l-.684.158a1.946 1.946 0 0 1-2.057-.817l-.555-.832a1.682 1.682 0 0 0-2.798 0l-.555.832a1.946 1.946 0 0 1-2.057.817Z"
    />
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </Svg>
);
export default SvgSettings;
