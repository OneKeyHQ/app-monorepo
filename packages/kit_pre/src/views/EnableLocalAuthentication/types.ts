export enum EnableLocalAuthenticationRoutes {
  EnableLocalAuthenticationModal = 'EnableLocalAuthenticationModal',
  EnableWebAuthn = 'EnableWebAuthn',
}

export type EnableLocalAuthenticationRoutesParams = {
  [EnableLocalAuthenticationRoutes.EnableLocalAuthenticationModal]: undefined;
  [EnableLocalAuthenticationRoutes.EnableWebAuthn]: undefined;
};
