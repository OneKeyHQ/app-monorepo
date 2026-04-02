import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export type IPerpAgentLifeCycleReason =
  | 'account_not_activated'
  | 'builder_fee_not_approved'
  | 'internal_rebate_not_bound'
  | 'agent_not_found'
  | 'agent_near_expiry'
  | 'agent_address_mismatch'
  | 'agent_credential_missing'
  | 'config_version_changed_reset'
  | 'runtime_invalid_agent_error'
  | 'agent_removed_for_slot_recovery'
  | 'agent_create_success'
  | 'agent_create_failed'
  // v3 withToast.ts reasons
  | 'runtime_invalid_agent_recovery_failed'
  | 'runtime_handle_error_failed'
  // v4 decrypt anomaly tracking
  | 'credential_legacy_no_password'
  | 'credential_decrypt_corrupted'
  | 'credential_unknown_format';

type IPerpAgentLifeCycleStatusDetails = {
  activatedOk?: boolean;
  agentOk?: boolean;
  referralCodeOk?: boolean;
  builderFeeOk?: boolean;
  internalRebateBoundOk?: boolean;
  stage?:
    | 'extra_agents_empty'
    | 'agent_address_missing'
    | 'no_valid_agent_credential'
    | 'created_but_local_credential_missing';
  agentName?: string;
  agentAddress?: string;
  chainAgentAddress?: string;
  localAgentAddress?: string;
  validUntil?: number;
  extraAgentsCount?: number;
  removeResultStatus?: string;
  configVersionOld?: string | number;
  configVersionNew?: string | number;
  expectBuilderAddress?: string;
  expectMaxBuilderFee?: number;
  currentMaxBuilderFee?: number;
  approveResultStatus?: string;
  errorMessage?: string;
};

export type IPerpAgentLifeCycleTrackReasonParams = {
  accountAddress?: string | null;
  accountId?: string | null;
  isEnableTradingTrigger?: boolean;
  reason: IPerpAgentLifeCycleReason;
  statusDetails?: IPerpAgentLifeCycleStatusDetails;
};

export class AgentLifeCycleScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public trackReason(params: IPerpAgentLifeCycleTrackReasonParams) {
    const { accountAddress, accountId, ...rest } = params;
    void accountAddress;
    void accountId;
    return rest;
  }
}
