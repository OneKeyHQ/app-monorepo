/**
 * ShadowAccountAnonymizer Contract ABI
 *
 * This file is auto-generated from Cairo build artifacts.
 * Do not edit manually - run 'npm run generate:anonymizer-abi' to regenerate.
 */

export const ShadowAccountAnonymizerABI = [
  {
    type: "impl",
    name: "ShadowAccountAnonymizerImpl",
    interface_name:
      "shadow_account_anonymizer::shadow_account_anonymizer::IShadowAccountAnonymizer",
  },
  {
    type: "struct",
    name: "core::array::Span::<core::felt252>",
    members: [
      {
        name: "snapshot",
        type: "@core::array::Array::<core::felt252>",
      },
    ],
  },
  {
    type: "struct",
    name: "core::starknet::account::Call",
    members: [
      {
        name: "to",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "selector",
        type: "core::felt252",
      },
      {
        name: "calldata",
        type: "core::array::Span::<core::felt252>",
      },
    ],
  },
  {
    type: "enum",
    name: "shadow_account_anonymizer::shadow_account_anonymizer::CollectPolicy",
    variants: [
      {
        name: "All",
        type: "()",
      },
      {
        name: "Diff",
        type: "()",
      },
      {
        name: "Exact",
        type: "core::integer::u128",
      },
    ],
  },
  {
    type: "struct",
    name: "shadow_account_anonymizer::shadow_account_anonymizer::OpenNote",
    members: [
      {
        name: "note_id",
        type: "core::felt252",
      },
      {
        name: "token",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "collect_policy",
        type: "shadow_account_anonymizer::shadow_account_anonymizer::CollectPolicy",
      },
    ],
  },
  {
    type: "struct",
    name: "core::array::Span::<shadow_account_anonymizer::shadow_account_anonymizer::OpenNote>",
    members: [
      {
        name: "snapshot",
        type: "@core::array::Array::<shadow_account_anonymizer::shadow_account_anonymizer::OpenNote>",
      },
    ],
  },
  {
    type: "struct",
    name: "privacy::objects::OpenNoteDeposit",
    members: [
      {
        name: "note_id",
        type: "core::felt252",
      },
      {
        name: "token",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "amount",
        type: "core::integer::u128",
      },
    ],
  },
  {
    type: "struct",
    name: "core::array::Span::<privacy::objects::OpenNoteDeposit>",
    members: [
      {
        name: "snapshot",
        type: "@core::array::Array::<privacy::objects::OpenNoteDeposit>",
      },
    ],
  },
  {
    type: "struct",
    name: "core::array::Span::<core::starknet::contract_address::ContractAddress>",
    members: [
      {
        name: "snapshot",
        type: "@core::array::Array::<core::starknet::contract_address::ContractAddress>",
      },
    ],
  },
  {
    type: "enum",
    name: "core::bool",
    variants: [
      {
        name: "False",
        type: "()",
      },
      {
        name: "True",
        type: "()",
      },
    ],
  },
  {
    type: "struct",
    name: "shadow_account_anonymizer::shadow_account_anonymizer::ShadowAccountInfo",
    members: [
      {
        name: "nonce",
        type: "core::integer::u64",
      },
      {
        name: "address",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "is_deployed",
        type: "core::bool",
      },
    ],
  },
  {
    type: "struct",
    name: "core::array::Span::<shadow_account_anonymizer::shadow_account_anonymizer::ShadowAccountInfo>",
    members: [
      {
        name: "snapshot",
        type: "@core::array::Array::<shadow_account_anonymizer::shadow_account_anonymizer::ShadowAccountInfo>",
      },
    ],
  },
  {
    type: "interface",
    name: "shadow_account_anonymizer::shadow_account_anonymizer::IShadowAccountAnonymizer",
    items: [
      {
        type: "function",
        name: "privacy_compute",
        inputs: [
          {
            name: "identity_key",
            type: "core::felt252",
          },
          {
            name: "dapp_name",
            type: "core::felt252",
          },
          {
            name: "nonce",
            type: "core::felt252",
          },
        ],
        outputs: [
          {
            type: "core::felt252",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "privacy_invoke_with_computation",
        inputs: [
          {
            name: "identity_commitment",
            type: "core::felt252",
          },
          {
            name: "calls",
            type: "core::array::Array::<core::starknet::account::Call>",
          },
          {
            name: "open_notes",
            type: "core::array::Span::<shadow_account_anonymizer::shadow_account_anonymizer::OpenNote>",
          },
        ],
        outputs: [
          {
            type: "(core::array::Span::<privacy::objects::OpenNoteDeposit>, core::array::Span::<core::starknet::contract_address::ContractAddress>)",
          },
        ],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "get_shadow_accounts",
        inputs: [
          {
            name: "partial_commitment",
            type: "core::felt252",
          },
          {
            name: "start_nonce",
            type: "core::integer::u64",
          },
          {
            name: "end_nonce",
            type: "core::integer::u64",
          },
          {
            name: "until_undeployed",
            type: "core::bool",
          },
        ],
        outputs: [
          {
            type: "core::array::Span::<shadow_account_anonymizer::shadow_account_anonymizer::ShadowAccountInfo>",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_shadow_account",
        inputs: [
          {
            name: "identity_commitment",
            type: "core::felt252",
          },
        ],
        outputs: [
          {
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_privacy_contract",
        inputs: [],
        outputs: [
          {
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_shadow_account_class_hash",
        inputs: [],
        outputs: [
          {
            type: "core::starknet::class_hash::ClassHash",
          },
        ],
        state_mutability: "view",
      },
    ],
  },
  {
    type: "impl",
    name: "ReplaceabilityImpl",
    interface_name: "starkware_utils::components::replaceability::interface::IReplaceable",
  },
  {
    type: "struct",
    name: "starkware_utils::components::replaceability::interface::EICData",
    members: [
      {
        name: "eic_hash",
        type: "core::starknet::class_hash::ClassHash",
      },
      {
        name: "eic_init_data",
        type: "core::array::Span::<core::felt252>",
      },
    ],
  },
  {
    type: "enum",
    name: "core::option::Option::<starkware_utils::components::replaceability::interface::EICData>",
    variants: [
      {
        name: "Some",
        type: "starkware_utils::components::replaceability::interface::EICData",
      },
      {
        name: "None",
        type: "()",
      },
    ],
  },
  {
    type: "struct",
    name: "starkware_utils::components::replaceability::interface::ImplementationData",
    members: [
      {
        name: "impl_hash",
        type: "core::starknet::class_hash::ClassHash",
      },
      {
        name: "eic_data",
        type: "core::option::Option::<starkware_utils::components::replaceability::interface::EICData>",
      },
      {
        name: "final",
        type: "core::bool",
      },
    ],
  },
  {
    type: "interface",
    name: "starkware_utils::components::replaceability::interface::IReplaceable",
    items: [
      {
        type: "function",
        name: "get_upgrade_delay",
        inputs: [],
        outputs: [
          {
            type: "core::integer::u64",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_impl_activation_time",
        inputs: [
          {
            name: "implementation_data",
            type: "starkware_utils::components::replaceability::interface::ImplementationData",
          },
        ],
        outputs: [
          {
            type: "core::integer::u64",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "add_new_implementation",
        inputs: [
          {
            name: "implementation_data",
            type: "starkware_utils::components::replaceability::interface::ImplementationData",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "add_new_implementation_unsafe",
        inputs: [
          {
            name: "implementation_data",
            type: "starkware_utils::components::replaceability::interface::ImplementationData",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "remove_implementation",
        inputs: [
          {
            name: "implementation_data",
            type: "starkware_utils::components::replaceability::interface::ImplementationData",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "replace_to",
        inputs: [
          {
            name: "implementation_data",
            type: "starkware_utils::components::replaceability::interface::ImplementationData",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "validate_upgradeability",
        inputs: [
          {
            name: "implementation_data",
            type: "starkware_utils::components::replaceability::interface::ImplementationData",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  {
    type: "impl",
    name: "CommonRolesImpl",
    interface_name: "starkware_utils::components::roles::interface::ICommonRoles",
  },
  {
    type: "enum",
    name: "starkware_utils::components::roles::interface::Role",
    variants: [
      {
        name: "AppGovernor",
        type: "()",
      },
      {
        name: "AppRoleAdmin",
        type: "()",
      },
      {
        name: "GovernanceAdmin",
        type: "()",
      },
      {
        name: "Operator",
        type: "()",
      },
      {
        name: "TokenAdmin",
        type: "()",
      },
      {
        name: "UpgradeAgent",
        type: "()",
      },
      {
        name: "UpgradeGovernor",
        type: "()",
      },
      {
        name: "SecurityAdmin",
        type: "()",
      },
      {
        name: "SecurityAgent",
        type: "()",
      },
      {
        name: "SecurityGovernor",
        type: "()",
      },
    ],
  },
  {
    type: "interface",
    name: "starkware_utils::components::roles::interface::ICommonRoles",
    items: [
      {
        type: "function",
        name: "grant_role",
        inputs: [
          {
            name: "role",
            type: "starkware_utils::components::roles::interface::Role",
          },
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "revoke_role",
        inputs: [
          {
            name: "role",
            type: "starkware_utils::components::roles::interface::Role",
          },
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "has_role",
        inputs: [
          {
            name: "role",
            type: "starkware_utils::components::roles::interface::Role",
          },
          {
            name: "account",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "core::bool",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "renounce",
        inputs: [
          {
            name: "role",
            type: "starkware_utils::components::roles::interface::Role",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "reclaim_legacy_roles",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "reclaim_legacy_roles_for_accounts",
        inputs: [
          {
            name: "accounts",
            type: "core::array::Span::<core::starknet::contract_address::ContractAddress>",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "disable_legacy_role_reclaim",
        inputs: [],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  {
    type: "constructor",
    name: "constructor",
    inputs: [
      {
        name: "privacy_contract",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "shadow_account_class_hash",
        type: "core::starknet::class_hash::ClassHash",
      },
      {
        name: "governance_admin",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
  },
  {
    type: "event",
    name: "starkware_utils::components::replaceability::interface::ImplementationAdded",
    kind: "struct",
    members: [
      {
        name: "implementation_data",
        type: "starkware_utils::components::replaceability::interface::ImplementationData",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "starkware_utils::components::replaceability::interface::ImplementationRemoved",
    kind: "struct",
    members: [
      {
        name: "implementation_data",
        type: "starkware_utils::components::replaceability::interface::ImplementationData",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "starkware_utils::components::replaceability::interface::ImplementationReplaced",
    kind: "struct",
    members: [
      {
        name: "implementation_data",
        type: "starkware_utils::components::replaceability::interface::ImplementationData",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "starkware_utils::components::replaceability::interface::ImplementationFinalized",
    kind: "struct",
    members: [
      {
        name: "impl_hash",
        type: "core::starknet::class_hash::ClassHash",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "starkware_utils::components::replaceability::replaceability::ReplaceabilityComponent::Event",
    kind: "enum",
    variants: [
      {
        name: "ImplementationAdded",
        type: "starkware_utils::components::replaceability::interface::ImplementationAdded",
        kind: "nested",
      },
      {
        name: "ImplementationRemoved",
        type: "starkware_utils::components::replaceability::interface::ImplementationRemoved",
        kind: "nested",
      },
      {
        name: "ImplementationReplaced",
        type: "starkware_utils::components::replaceability::interface::ImplementationReplaced",
        kind: "nested",
      },
      {
        name: "ImplementationFinalized",
        type: "starkware_utils::components::replaceability::interface::ImplementationFinalized",
        kind: "nested",
      },
    ],
  },
  {
    type: "event",
    name: "starkware_utils::components::common_roles::common_roles::CommonRolesComponent::Event",
    kind: "enum",
    variants: [],
  },
  {
    type: "event",
    name: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGranted",
    kind: "struct",
    members: [
      {
        name: "role",
        type: "core::felt252",
        kind: "data",
      },
      {
        name: "account",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "sender",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGrantedWithDelay",
    kind: "struct",
    members: [
      {
        name: "role",
        type: "core::felt252",
        kind: "data",
      },
      {
        name: "account",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "sender",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "delay",
        type: "core::integer::u64",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleRevoked",
    kind: "struct",
    members: [
      {
        name: "role",
        type: "core::felt252",
        kind: "data",
      },
      {
        name: "account",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "sender",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleAdminChanged",
    kind: "struct",
    members: [
      {
        name: "role",
        type: "core::felt252",
        kind: "data",
      },
      {
        name: "previous_admin_role",
        type: "core::felt252",
        kind: "data",
      },
      {
        name: "new_admin_role",
        type: "core::felt252",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::Event",
    kind: "enum",
    variants: [
      {
        name: "RoleGranted",
        type: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGranted",
        kind: "nested",
      },
      {
        name: "RoleGrantedWithDelay",
        type: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGrantedWithDelay",
        kind: "nested",
      },
      {
        name: "RoleRevoked",
        type: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleRevoked",
        kind: "nested",
      },
      {
        name: "RoleAdminChanged",
        type: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleAdminChanged",
        kind: "nested",
      },
    ],
  },
  {
    type: "event",
    name: "openzeppelin_introspection::src5::SRC5Component::Event",
    kind: "enum",
    variants: [],
  },
  {
    type: "event",
    name: "shadow_account_anonymizer::shadow_account_anonymizer::ShadowAccountAnonymizer::ShadowAccountDeployed",
    kind: "struct",
    members: [
      {
        name: "identity_commitment",
        type: "core::felt252",
        kind: "key",
      },
      {
        name: "shadow_account",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "key",
      },
    ],
  },
  {
    type: "event",
    name: "shadow_account_anonymizer::shadow_account_anonymizer::ShadowAccountAnonymizer::Event",
    kind: "enum",
    variants: [
      {
        name: "ReplaceabilityEvent",
        type: "starkware_utils::components::replaceability::replaceability::ReplaceabilityComponent::Event",
        kind: "flat",
      },
      {
        name: "CommonRolesEvent",
        type: "starkware_utils::components::common_roles::common_roles::CommonRolesComponent::Event",
        kind: "flat",
      },
      {
        name: "AccessControlEvent",
        type: "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::Event",
        kind: "flat",
      },
      {
        name: "SRC5Event",
        type: "openzeppelin_introspection::src5::SRC5Component::Event",
        kind: "flat",
      },
      {
        name: "ShadowAccountDeployed",
        type: "shadow_account_anonymizer::shadow_account_anonymizer::ShadowAccountAnonymizer::ShadowAccountDeployed",
        kind: "nested",
      },
    ],
  },
] as const;
