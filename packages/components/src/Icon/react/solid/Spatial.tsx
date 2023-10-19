import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSpatial = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 3.732 3.84 5.557a3 3 0 0 0-1.5 2.598v1.732L7 12.577V3.732Zm-4.66 8.464v3.65a3 3 0 0 0 1.5 2.597l1.5.866L10 16.62l-7.66-4.423Zm5 8.268 3.16 1.825a3 3 0 0 0 3 0l1.5-.866v-5.381l-7.66 4.422Zm9.66-.196 3.16-1.825a3 3 0 0 0 1.5-2.598v-1.732L17 11.423v8.845Zm4.66-8.464v-3.65a3 3 0 0 0-1.5-2.597l-1.5-.866L14 7.38l7.66 4.423Zm-5-8.268L13.5 1.71a3 3 0 0 0-3 0L9 2.577V7.96l7.66-4.423ZM12 15.464l-3-1.732v-3.464l3-1.732 3 1.732v3.464l-3 1.732Z"
    />
  </Svg>
);
export default SvgSpatial;
