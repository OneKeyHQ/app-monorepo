import { type FC, useEffect } from 'react';

import { Box, Icon, NetImage } from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';

type FaviconProps = {
  logoURL: string;
  url: string;
  isHovered?: boolean;
};
export const Favicon: FC<FaviconProps> = ({ logoURL, url, isHovered }) => {
  useEffect(() => {
    if (url && !logoURL) {
      backgroundApiProxy.serviceDiscover.fillInUserBrowserHistory({ url });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Box
      justifyContent="center"
      alignItems="center"
      width="12"
      height="12"
      borderRadius={12}
      borderWidth="1px"
      bgColor={isHovered ? 'surface-hovered' : 'surface-subdued'}
      borderColor={isHovered ? 'border-hovered' : 'border-subdued'}
    >
      <Box width="8" height="8">
        {logoURL ? (
          <NetImage
            src={logoURL}
            width="32px"
            height="32px"
            borderRadius="8px"
            fallbackElement={
              <Box
                borderRadius={8}
                overflow="hidden"
                justifyContent="center"
                alignItems="center"
                width="32px"
                height="32px"
              >
                <Icon size={16} name="GlobeAltMini" />
              </Box>
            }
          />
        ) : (
          <Box
            borderRadius={8}
            justifyContent="center"
            alignItems="center"
            width="32px"
            height="32px"
          >
            <Icon size={16} name="GlobeAltMini" />
          </Box>
        )}
      </Box>
    </Box>
  );
};
