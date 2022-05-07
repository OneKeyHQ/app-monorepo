import * as React from 'react';

import Svg, { Path, SvgProps } from 'react-native-svg';

function SvgDiscovery(props: SvgProps) {
  return (
    <Svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <Path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M1.99989 12.0001C1.99989 6.48011 6.46989 2.00011 11.9999 2.00011C17.5199 2.00011 21.9999 6.48011 21.9999 12.0001C21.9999 17.5301 17.5199 22.0001 11.9999 22.0001C6.46989 22.0001 1.99989 17.5301 1.99989 12.0001ZM14.2299 13.8301L15.8499 8.71011C15.9599 8.36011 15.6399 8.03011 15.2899 8.14011L10.1699 9.74011C9.95989 9.81011 9.78989 9.97011 9.72989 10.1801L8.12989 15.3101C8.01989 15.6501 8.34989 15.9801 8.68989 15.8701L13.7899 14.2701C13.9999 14.2101 14.1699 14.0401 14.2299 13.8301Z"
      />
    </Svg>
  );
}

export default SvgDiscovery;
