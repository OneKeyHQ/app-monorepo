import CreateAccountModal, { CreateAccountModalRoutes } from './CreateAccount';

const modalStackScreenList = [
  {
    name: CreateAccountModalRoutes.CreateAccountForm,
    component: CreateAccountModal,
  },
];

export const ModalRoutes = { ...CreateAccountModalRoutes };

export default modalStackScreenList;
