import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgPaperAirplane(props: SvgProps) {
  return (
    <Svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </Svg>
  );
}

export default SvgPaperAirplane;
