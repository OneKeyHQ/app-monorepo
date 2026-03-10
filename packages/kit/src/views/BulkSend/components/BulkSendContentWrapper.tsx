import { type IStackProps, Stack } from '@onekeyhq/components';

function BulkSendContentWrapper({
  children,
  ...rest
}: {
  children: React.ReactNode;
} & IStackProps) {
  return (
    <Stack
      width="100%"
      px="$5"
      pb="$5"
      $gtMd={{
        mt: '$8',
        px: '$0',
        mx: 'auto',
        maxWidth: '$180',
      }}
      bg="$bgApp"
      {...rest}
    >
      {children}
    </Stack>
  );
}

export default BulkSendContentWrapper;
