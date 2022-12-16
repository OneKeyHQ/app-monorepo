import { Button, Center, Typography } from '@onekeyhq/components';

import useNavigation from '../../hooks/useNavigation';

const Approval = () => {
  const navigation = useNavigation();
  return (
    <Center flex="1" bg="background-hovered">
      <Button onPress={() => navigation.navigate('component/address' as any)}>
        Go To Components
      </Button>
      <Typography.Body2>Approval</Typography.Body2>
      <Button
        onPress={() => console.log('TODO: call hardware sign transaction')}
      >
        Approval Transaction
      </Button>
    </Center>
  );
};
export default Approval;
