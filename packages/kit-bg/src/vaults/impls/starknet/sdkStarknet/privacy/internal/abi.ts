/**
 * Privacy Pool Contract ABI
 *
 * This file is auto-generated from Cairo build artifacts.
 * Do not edit manually - run 'npm run generate:abi' to regenerate.
 *
 * The 'as const' assertion enables TypeScript to infer exact literal types,
 * which allows starknet.js's .typedv2() to provide full autocomplete
 * and type checking for contract methods.
 */

export const PrivacyPoolABI = [
  {
    "type": "impl",
    "name": "ClientImpl",
    "interface_name": "privacy::interface::IClient"
  },
  {
    "type": "struct",
    "name": "core::array::Span::<core::felt252>",
    "members": [
      {
        "name": "snapshot",
        "type": "@core::array::Array::<core::felt252>"
      }
    ]
  },
  {
    "type": "struct",
    "name": "core::starknet::account::Call",
    "members": [
      {
        "name": "to",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "selector",
        "type": "core::felt252"
      },
      {
        "name": "calldata",
        "type": "core::array::Span::<core::felt252>"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::SetViewingKeyInput",
    "members": [
      {
        "name": "random",
        "type": "core::felt252"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::OpenChannelInput",
    "members": [
      {
        "name": "recipient_addr",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "index",
        "type": "core::integer::u32"
      },
      {
        "name": "random",
        "type": "core::felt252"
      },
      {
        "name": "salt",
        "type": "core::felt252"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::OpenSubchannelInput",
    "members": [
      {
        "name": "recipient_addr",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "recipient_public_key",
        "type": "core::felt252"
      },
      {
        "name": "channel_key",
        "type": "core::felt252"
      },
      {
        "name": "index",
        "type": "core::integer::u32"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "salt",
        "type": "core::felt252"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::CreateEncNoteInput",
    "members": [
      {
        "name": "recipient_addr",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "recipient_public_key",
        "type": "core::felt252"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "amount",
        "type": "core::integer::u128"
      },
      {
        "name": "index",
        "type": "core::integer::u32"
      },
      {
        "name": "salt",
        "type": "core::integer::u128"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::CreateOpenNoteInput",
    "members": [
      {
        "name": "recipient_addr",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "recipient_public_key",
        "type": "core::felt252"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "index",
        "type": "core::integer::u32"
      },
      {
        "name": "random",
        "type": "core::felt252"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::DepositInput",
    "members": [
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "amount",
        "type": "core::integer::u128"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::UseNoteInput",
    "members": [
      {
        "name": "channel_key",
        "type": "core::felt252"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "index",
        "type": "core::integer::u32"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::WithdrawInput",
    "members": [
      {
        "name": "to_addr",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "amount",
        "type": "core::integer::u128"
      },
      {
        "name": "random",
        "type": "core::felt252"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::InvokeExternalInput",
    "members": [
      {
        "name": "contract_address",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "calldata",
        "type": "core::array::Span::<core::felt252>"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::ComputeAndInvokeInput",
    "members": [
      {
        "name": "contract_address",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "compute_additional_data",
        "type": "core::array::Span::<core::felt252>"
      },
      {
        "name": "invoke_additional_data",
        "type": "core::array::Span::<core::felt252>"
      }
    ]
  },
  {
    "type": "enum",
    "name": "privacy::actions::ClientAction",
    "variants": [
      {
        "name": "SetViewingKey",
        "type": "privacy::actions::SetViewingKeyInput"
      },
      {
        "name": "OpenChannel",
        "type": "privacy::actions::OpenChannelInput"
      },
      {
        "name": "OpenSubchannel",
        "type": "privacy::actions::OpenSubchannelInput"
      },
      {
        "name": "CreateEncNote",
        "type": "privacy::actions::CreateEncNoteInput"
      },
      {
        "name": "CreateOpenNote",
        "type": "privacy::actions::CreateOpenNoteInput"
      },
      {
        "name": "Deposit",
        "type": "privacy::actions::DepositInput"
      },
      {
        "name": "UseNote",
        "type": "privacy::actions::UseNoteInput"
      },
      {
        "name": "Withdraw",
        "type": "privacy::actions::WithdrawInput"
      },
      {
        "name": "InvokeExternal",
        "type": "privacy::actions::InvokeExternalInput"
      },
      {
        "name": "ComputeAndInvoke",
        "type": "privacy::actions::ComputeAndInvokeInput"
      }
    ]
  },
  {
    "type": "struct",
    "name": "core::array::Span::<privacy::actions::ClientAction>",
    "members": [
      {
        "name": "snapshot",
        "type": "@core::array::Array::<privacy::actions::ClientAction>"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::WriteOnceInput",
    "members": [
      {
        "name": "storage_address",
        "type": "core::felt252"
      },
      {
        "name": "value",
        "type": "core::array::Span::<core::felt252>"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::objects::EncChannelInfo",
    "members": [
      {
        "name": "ephemeral_pubkey",
        "type": "core::felt252"
      },
      {
        "name": "enc_channel_key",
        "type": "core::felt252"
      },
      {
        "name": "enc_sender_addr",
        "type": "core::felt252"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::AppendInput",
    "members": [
      {
        "name": "recipient_addr",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "enc_channel_info",
        "type": "privacy::objects::EncChannelInfo"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::TransferFromInput",
    "members": [
      {
        "name": "from_addr",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "amount",
        "type": "core::integer::u128"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::TransferToInput",
    "members": [
      {
        "name": "to_addr",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "amount",
        "type": "core::integer::u128"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::objects::EncPrivateKey",
    "members": [
      {
        "name": "auditor_public_key",
        "type": "core::felt252"
      },
      {
        "name": "ephemeral_pubkey",
        "type": "core::felt252"
      },
      {
        "name": "enc_private_key",
        "type": "core::felt252"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::events::ViewingKeySet",
    "members": [
      {
        "name": "user_addr",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "public_key",
        "type": "core::felt252"
      },
      {
        "name": "enc_private_key",
        "type": "privacy::objects::EncPrivateKey"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::objects::EncUserAddr",
    "members": [
      {
        "name": "auditor_public_key",
        "type": "core::felt252"
      },
      {
        "name": "ephemeral_pubkey",
        "type": "core::felt252"
      },
      {
        "name": "enc_user_addr",
        "type": "core::felt252"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::events::Withdrawal",
    "members": [
      {
        "name": "enc_user_addr",
        "type": "privacy::objects::EncUserAddr"
      },
      {
        "name": "to_addr",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "amount",
        "type": "core::integer::u128"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::events::Deposit",
    "members": [
      {
        "name": "user_addr",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "amount",
        "type": "core::integer::u128"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::events::OpenNoteCreated",
    "members": [
      {
        "name": "enc_recipient_addr",
        "type": "privacy::objects::EncUserAddr"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "note_id",
        "type": "core::felt252"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::events::EncNoteCreated",
    "members": [
      {
        "name": "note_id",
        "type": "core::felt252"
      },
      {
        "name": "packed_value",
        "type": "core::felt252"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::events::NoteUsed",
    "members": [
      {
        "name": "nullifier",
        "type": "core::felt252"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::actions::InvokeInput",
    "members": [
      {
        "name": "contract_address",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "calldata",
        "type": "core::array::Span::<core::felt252>"
      }
    ]
  },
  {
    "type": "enum",
    "name": "privacy::actions::ServerAction",
    "variants": [
      {
        "name": "WriteOnce",
        "type": "privacy::actions::WriteOnceInput"
      },
      {
        "name": "Append",
        "type": "privacy::actions::AppendInput"
      },
      {
        "name": "TransferFrom",
        "type": "privacy::actions::TransferFromInput"
      },
      {
        "name": "TransferTo",
        "type": "privacy::actions::TransferToInput"
      },
      {
        "name": "EmitViewingKeySet",
        "type": "privacy::events::ViewingKeySet"
      },
      {
        "name": "EmitWithdrawal",
        "type": "privacy::events::Withdrawal"
      },
      {
        "name": "EmitDeposit",
        "type": "privacy::events::Deposit"
      },
      {
        "name": "EmitOpenNoteCreated",
        "type": "privacy::events::OpenNoteCreated"
      },
      {
        "name": "EmitEncNoteCreated",
        "type": "privacy::events::EncNoteCreated"
      },
      {
        "name": "EmitNoteUsed",
        "type": "privacy::events::NoteUsed"
      },
      {
        "name": "Invoke",
        "type": "privacy::actions::InvokeInput"
      },
      {
        "name": "InvokeWithComputation",
        "type": "privacy::actions::InvokeInput"
      }
    ]
  },
  {
    "type": "struct",
    "name": "core::array::Span::<privacy::actions::ServerAction>",
    "members": [
      {
        "name": "snapshot",
        "type": "@core::array::Array::<privacy::actions::ServerAction>"
      }
    ]
  },
  {
    "type": "interface",
    "name": "privacy::interface::IClient",
    "items": [
      {
        "type": "function",
        "name": "__execute__",
        "inputs": [
          {
            "name": "calls",
            "type": "core::array::Array::<core::starknet::account::Call>"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "compile_and_panic",
        "inputs": [
          {
            "name": "user_addr",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "user_private_key",
            "type": "core::felt252"
          },
          {
            "name": "client_actions",
            "type": "core::array::Span::<privacy::actions::ClientAction>"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "compile_actions",
        "inputs": [
          {
            "name": "user_addr",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "user_private_key",
            "type": "core::felt252"
          },
          {
            "name": "client_actions",
            "type": "core::array::Span::<privacy::actions::ClientAction>"
          }
        ],
        "outputs": [
          {
            "type": "core::array::Span::<privacy::actions::ServerAction>"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "__validate__",
        "inputs": [
          {
            "name": "calls",
            "type": "core::array::Array::<core::starknet::account::Call>"
          }
        ],
        "outputs": [
          {
            "type": "core::felt252"
          }
        ],
        "state_mutability": "view"
      }
    ]
  },
  {
    "type": "impl",
    "name": "ServerImpl",
    "interface_name": "privacy::interface::IServer"
  },
  {
    "type": "struct",
    "name": "privacy::snip12::ScreeningAttestation",
    "members": [
      {
        "name": "issued_at",
        "type": "core::integer::u64"
      },
      {
        "name": "signature",
        "type": "(core::felt252, core::felt252)"
      }
    ]
  },
  {
    "type": "enum",
    "name": "core::option::Option::<privacy::snip12::ScreeningAttestation>",
    "variants": [
      {
        "name": "Some",
        "type": "privacy::snip12::ScreeningAttestation"
      },
      {
        "name": "None",
        "type": "()"
      }
    ]
  },
  {
    "type": "interface",
    "name": "privacy::interface::IServer",
    "items": [
      {
        "type": "function",
        "name": "apply_actions",
        "inputs": [
          {
            "name": "actions",
            "type": "core::array::Span::<privacy::actions::ServerAction>"
          },
          {
            "name": "screening",
            "type": "core::option::Option::<privacy::snip12::ScreeningAttestation>"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      }
    ]
  },
  {
    "type": "impl",
    "name": "ViewsImpl",
    "interface_name": "privacy::interface::IViews"
  },
  {
    "type": "enum",
    "name": "core::bool",
    "variants": [
      {
        "name": "False",
        "type": "()"
      },
      {
        "name": "True",
        "type": "()"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::objects::EncSubchannelInfo",
    "members": [
      {
        "name": "salt",
        "type": "core::felt252"
      },
      {
        "name": "enc_token",
        "type": "core::felt252"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::objects::EncOutgoingChannelInfo",
    "members": [
      {
        "name": "salt",
        "type": "core::felt252"
      },
      {
        "name": "enc_recipient_addr",
        "type": "core::felt252"
      }
    ]
  },
  {
    "type": "struct",
    "name": "privacy::objects::Note",
    "members": [
      {
        "name": "packed_value",
        "type": "core::felt252"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress"
      }
    ]
  },
  {
    "type": "enum",
    "name": "privacy::objects::OpenNoteScreeningPolicy",
    "variants": [
      {
        "name": "Required",
        "type": "()"
      },
      {
        "name": "Exempt",
        "type": "()"
      },
      {
        "name": "Delegated",
        "type": "()"
      }
    ]
  },
  {
    "type": "interface",
    "name": "privacy::interface::IViews",
    "items": [
      {
        "type": "function",
        "name": "channel_exists",
        "inputs": [
          {
            "name": "channel_marker",
            "type": "core::felt252"
          }
        ],
        "outputs": [
          {
            "type": "core::bool"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_num_of_channels",
        "inputs": [
          {
            "name": "recipient_addr",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::integer::u64"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_channel_info",
        "inputs": [
          {
            "name": "recipient_addr",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "channel_index",
            "type": "core::integer::u64"
          }
        ],
        "outputs": [
          {
            "type": "privacy::objects::EncChannelInfo"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "subchannel_exists",
        "inputs": [
          {
            "name": "subchannel_marker",
            "type": "core::felt252"
          }
        ],
        "outputs": [
          {
            "type": "core::bool"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_subchannel_info",
        "inputs": [
          {
            "name": "subchannel_id",
            "type": "core::felt252"
          }
        ],
        "outputs": [
          {
            "type": "privacy::objects::EncSubchannelInfo"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_outgoing_channel_info",
        "inputs": [
          {
            "name": "outgoing_channel_id",
            "type": "core::felt252"
          }
        ],
        "outputs": [
          {
            "type": "privacy::objects::EncOutgoingChannelInfo"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_note",
        "inputs": [
          {
            "name": "note_id",
            "type": "core::felt252"
          }
        ],
        "outputs": [
          {
            "type": "privacy::objects::Note"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "nullifier_exists",
        "inputs": [
          {
            "name": "nullifier",
            "type": "core::felt252"
          }
        ],
        "outputs": [
          {
            "type": "core::bool"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_public_key",
        "inputs": [
          {
            "name": "user_addr",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::felt252"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_enc_private_key",
        "inputs": [
          {
            "name": "user_addr",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "privacy::objects::EncPrivateKey"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_auditor_public_key",
        "inputs": [],
        "outputs": [
          {
            "type": "core::felt252"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_screener_public_key",
        "inputs": [],
        "outputs": [
          {
            "type": "core::felt252"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_version",
        "inputs": [],
        "outputs": [
          {
            "type": "core::felt252"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_fee_amount",
        "inputs": [],
        "outputs": [
          {
            "type": "core::integer::u128"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_fee_collector",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_proof_validity_blocks",
        "inputs": [],
        "outputs": [
          {
            "type": "core::integer::u64"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_open_note_screening_policy",
        "inputs": [
          {
            "name": "depositor",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "privacy::objects::OpenNoteScreeningPolicy"
          }
        ],
        "state_mutability": "view"
      }
    ]
  },
  {
    "type": "impl",
    "name": "AdminImpl",
    "interface_name": "privacy::interface::IAdmin"
  },
  {
    "type": "interface",
    "name": "privacy::interface::IAdmin",
    "items": [
      {
        "type": "function",
        "name": "set_auditor_public_key",
        "inputs": [
          {
            "name": "auditor_public_key",
            "type": "core::felt252"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_screener_public_key",
        "inputs": [
          {
            "name": "screener_public_key",
            "type": "core::felt252"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_fee_amount",
        "inputs": [
          {
            "name": "fee_amount",
            "type": "core::integer::u128"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_fee_collector",
        "inputs": [
          {
            "name": "fee_collector",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_proof_validity_blocks",
        "inputs": [
          {
            "name": "proof_validity_blocks",
            "type": "core::integer::u64"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_open_note_screening_policy",
        "inputs": [
          {
            "name": "depositor",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "policy",
            "type": "privacy::objects::OpenNoteScreeningPolicy"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      }
    ]
  },
  {
    "type": "impl",
    "name": "PausableImpl",
    "interface_name": "starkware_utils::components::pausable::interface::IPausable"
  },
  {
    "type": "interface",
    "name": "starkware_utils::components::pausable::interface::IPausable",
    "items": [
      {
        "type": "function",
        "name": "is_paused",
        "inputs": [],
        "outputs": [
          {
            "type": "core::bool"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "pause",
        "inputs": [],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "unpause",
        "inputs": [],
        "outputs": [],
        "state_mutability": "external"
      }
    ]
  },
  {
    "type": "impl",
    "name": "ReplaceabilityImpl",
    "interface_name": "starkware_utils::components::replaceability::interface::IReplaceable"
  },
  {
    "type": "struct",
    "name": "starkware_utils::components::replaceability::interface::EICData",
    "members": [
      {
        "name": "eic_hash",
        "type": "core::starknet::class_hash::ClassHash"
      },
      {
        "name": "eic_init_data",
        "type": "core::array::Span::<core::felt252>"
      }
    ]
  },
  {
    "type": "enum",
    "name": "core::option::Option::<starkware_utils::components::replaceability::interface::EICData>",
    "variants": [
      {
        "name": "Some",
        "type": "starkware_utils::components::replaceability::interface::EICData"
      },
      {
        "name": "None",
        "type": "()"
      }
    ]
  },
  {
    "type": "struct",
    "name": "starkware_utils::components::replaceability::interface::ImplementationData",
    "members": [
      {
        "name": "impl_hash",
        "type": "core::starknet::class_hash::ClassHash"
      },
      {
        "name": "eic_data",
        "type": "core::option::Option::<starkware_utils::components::replaceability::interface::EICData>"
      },
      {
        "name": "final",
        "type": "core::bool"
      }
    ]
  },
  {
    "type": "interface",
    "name": "starkware_utils::components::replaceability::interface::IReplaceable",
    "items": [
      {
        "type": "function",
        "name": "get_upgrade_delay",
        "inputs": [],
        "outputs": [
          {
            "type": "core::integer::u64"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_impl_activation_time",
        "inputs": [
          {
            "name": "implementation_data",
            "type": "starkware_utils::components::replaceability::interface::ImplementationData"
          }
        ],
        "outputs": [
          {
            "type": "core::integer::u64"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "add_new_implementation",
        "inputs": [
          {
            "name": "implementation_data",
            "type": "starkware_utils::components::replaceability::interface::ImplementationData"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "add_new_implementation_unsafe",
        "inputs": [
          {
            "name": "implementation_data",
            "type": "starkware_utils::components::replaceability::interface::ImplementationData"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "remove_implementation",
        "inputs": [
          {
            "name": "implementation_data",
            "type": "starkware_utils::components::replaceability::interface::ImplementationData"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "replace_to",
        "inputs": [
          {
            "name": "implementation_data",
            "type": "starkware_utils::components::replaceability::interface::ImplementationData"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "validate_upgradeability",
        "inputs": [
          {
            "name": "implementation_data",
            "type": "starkware_utils::components::replaceability::interface::ImplementationData"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      }
    ]
  },
  {
    "type": "impl",
    "name": "CommonRolesImpl",
    "interface_name": "starkware_utils::components::roles::interface::ICommonRoles"
  },
  {
    "type": "enum",
    "name": "starkware_utils::components::roles::interface::Role",
    "variants": [
      {
        "name": "AppGovernor",
        "type": "()"
      },
      {
        "name": "AppRoleAdmin",
        "type": "()"
      },
      {
        "name": "GovernanceAdmin",
        "type": "()"
      },
      {
        "name": "Operator",
        "type": "()"
      },
      {
        "name": "TokenAdmin",
        "type": "()"
      },
      {
        "name": "UpgradeAgent",
        "type": "()"
      },
      {
        "name": "UpgradeGovernor",
        "type": "()"
      },
      {
        "name": "SecurityAdmin",
        "type": "()"
      },
      {
        "name": "SecurityAgent",
        "type": "()"
      },
      {
        "name": "SecurityGovernor",
        "type": "()"
      }
    ]
  },
  {
    "type": "struct",
    "name": "core::array::Span::<core::starknet::contract_address::ContractAddress>",
    "members": [
      {
        "name": "snapshot",
        "type": "@core::array::Array::<core::starknet::contract_address::ContractAddress>"
      }
    ]
  },
  {
    "type": "interface",
    "name": "starkware_utils::components::roles::interface::ICommonRoles",
    "items": [
      {
        "type": "function",
        "name": "grant_role",
        "inputs": [
          {
            "name": "role",
            "type": "starkware_utils::components::roles::interface::Role"
          },
          {
            "name": "account",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "revoke_role",
        "inputs": [
          {
            "name": "role",
            "type": "starkware_utils::components::roles::interface::Role"
          },
          {
            "name": "account",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "has_role",
        "inputs": [
          {
            "name": "role",
            "type": "starkware_utils::components::roles::interface::Role"
          },
          {
            "name": "account",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::bool"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "renounce",
        "inputs": [
          {
            "name": "role",
            "type": "starkware_utils::components::roles::interface::Role"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "reclaim_legacy_roles",
        "inputs": [],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "reclaim_legacy_roles_for_accounts",
        "inputs": [
          {
            "name": "accounts",
            "type": "core::array::Span::<core::starknet::contract_address::ContractAddress>"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "disable_legacy_role_reclaim",
        "inputs": [],
        "outputs": [],
        "state_mutability": "external"
      }
    ]
  },
  {
    "type": "constructor",
    "name": "constructor",
    "inputs": [
      {
        "name": "governance_admin",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "auditor_public_key",
        "type": "core::felt252"
      },
      {
        "name": "screener_public_key",
        "type": "core::felt252"
      },
      {
        "name": "proof_validity_blocks",
        "type": "core::integer::u64"
      }
    ]
  },
  {
    "type": "event",
    "name": "starkware_utils::components::pausable::pausable::PausableComponent::Paused",
    "kind": "struct",
    "members": [
      {
        "name": "account",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "starkware_utils::components::pausable::pausable::PausableComponent::Unpaused",
    "kind": "struct",
    "members": [
      {
        "name": "account",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "starkware_utils::components::pausable::pausable::PausableComponent::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "Paused",
        "type": "starkware_utils::components::pausable::pausable::PausableComponent::Paused",
        "kind": "nested"
      },
      {
        "name": "Unpaused",
        "type": "starkware_utils::components::pausable::pausable::PausableComponent::Unpaused",
        "kind": "nested"
      }
    ]
  },
  {
    "type": "event",
    "name": "starkware_utils::components::replaceability::interface::ImplementationAdded",
    "kind": "struct",
    "members": [
      {
        "name": "implementation_data",
        "type": "starkware_utils::components::replaceability::interface::ImplementationData",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "starkware_utils::components::replaceability::interface::ImplementationRemoved",
    "kind": "struct",
    "members": [
      {
        "name": "implementation_data",
        "type": "starkware_utils::components::replaceability::interface::ImplementationData",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "starkware_utils::components::replaceability::interface::ImplementationReplaced",
    "kind": "struct",
    "members": [
      {
        "name": "implementation_data",
        "type": "starkware_utils::components::replaceability::interface::ImplementationData",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "starkware_utils::components::replaceability::interface::ImplementationFinalized",
    "kind": "struct",
    "members": [
      {
        "name": "impl_hash",
        "type": "core::starknet::class_hash::ClassHash",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "starkware_utils::components::replaceability::replaceability::ReplaceabilityComponent::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "ImplementationAdded",
        "type": "starkware_utils::components::replaceability::interface::ImplementationAdded",
        "kind": "nested"
      },
      {
        "name": "ImplementationRemoved",
        "type": "starkware_utils::components::replaceability::interface::ImplementationRemoved",
        "kind": "nested"
      },
      {
        "name": "ImplementationReplaced",
        "type": "starkware_utils::components::replaceability::interface::ImplementationReplaced",
        "kind": "nested"
      },
      {
        "name": "ImplementationFinalized",
        "type": "starkware_utils::components::replaceability::interface::ImplementationFinalized",
        "kind": "nested"
      }
    ]
  },
  {
    "type": "event",
    "name": "starkware_utils::components::common_roles::common_roles::CommonRolesComponent::Event",
    "kind": "enum",
    "variants": []
  },
  {
    "type": "event",
    "name": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGranted",
    "kind": "struct",
    "members": [
      {
        "name": "role",
        "type": "core::felt252",
        "kind": "data"
      },
      {
        "name": "account",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "sender",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGrantedWithDelay",
    "kind": "struct",
    "members": [
      {
        "name": "role",
        "type": "core::felt252",
        "kind": "data"
      },
      {
        "name": "account",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "sender",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "delay",
        "type": "core::integer::u64",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleRevoked",
    "kind": "struct",
    "members": [
      {
        "name": "role",
        "type": "core::felt252",
        "kind": "data"
      },
      {
        "name": "account",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "sender",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleAdminChanged",
    "kind": "struct",
    "members": [
      {
        "name": "role",
        "type": "core::felt252",
        "kind": "data"
      },
      {
        "name": "previous_admin_role",
        "type": "core::felt252",
        "kind": "data"
      },
      {
        "name": "new_admin_role",
        "type": "core::felt252",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "RoleGranted",
        "type": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGranted",
        "kind": "nested"
      },
      {
        "name": "RoleGrantedWithDelay",
        "type": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGrantedWithDelay",
        "kind": "nested"
      },
      {
        "name": "RoleRevoked",
        "type": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleRevoked",
        "kind": "nested"
      },
      {
        "name": "RoleAdminChanged",
        "type": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleAdminChanged",
        "kind": "nested"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_introspection::src5::SRC5Component::Event",
    "kind": "enum",
    "variants": []
  },
  {
    "type": "event",
    "name": "openzeppelin_security::reentrancyguard::ReentrancyGuardComponent::Event",
    "kind": "enum",
    "variants": []
  },
  {
    "type": "event",
    "name": "privacy::events::ViewingKeySet",
    "kind": "struct",
    "members": [
      {
        "name": "user_addr",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "public_key",
        "type": "core::felt252",
        "kind": "key"
      },
      {
        "name": "enc_private_key",
        "type": "privacy::objects::EncPrivateKey",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "privacy::events::Withdrawal",
    "kind": "struct",
    "members": [
      {
        "name": "enc_user_addr",
        "type": "privacy::objects::EncUserAddr",
        "kind": "data"
      },
      {
        "name": "to_addr",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "amount",
        "type": "core::integer::u128",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "privacy::events::Deposit",
    "kind": "struct",
    "members": [
      {
        "name": "user_addr",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "amount",
        "type": "core::integer::u128",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "privacy::events::AuditorPublicKeySet",
    "kind": "struct",
    "members": [
      {
        "name": "auditor_public_key",
        "type": "core::felt252",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "privacy::events::ScreenerPublicKeySet",
    "kind": "struct",
    "members": [
      {
        "name": "screener_public_key",
        "type": "core::felt252",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "privacy::events::OpenNoteCreated",
    "kind": "struct",
    "members": [
      {
        "name": "enc_recipient_addr",
        "type": "privacy::objects::EncUserAddr",
        "kind": "data"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "note_id",
        "type": "core::felt252",
        "kind": "key"
      }
    ]
  },
  {
    "type": "event",
    "name": "privacy::events::EncNoteCreated",
    "kind": "struct",
    "members": [
      {
        "name": "note_id",
        "type": "core::felt252",
        "kind": "key"
      },
      {
        "name": "packed_value",
        "type": "core::felt252",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "privacy::events::OpenNoteDeposited",
    "kind": "struct",
    "members": [
      {
        "name": "depositor",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "token",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "note_id",
        "type": "core::felt252",
        "kind": "key"
      },
      {
        "name": "amount",
        "type": "core::integer::u128",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "privacy::events::ExternalContractInvoked",
    "kind": "struct",
    "members": [
      {
        "name": "contract_address",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "selector",
        "type": "core::felt252",
        "kind": "key"
      }
    ]
  },
  {
    "type": "event",
    "name": "privacy::events::NoteUsed",
    "kind": "struct",
    "members": [
      {
        "name": "nullifier",
        "type": "core::felt252",
        "kind": "key"
      }
    ]
  },
  {
    "type": "event",
    "name": "privacy::events::FeeAmountSet",
    "kind": "struct",
    "members": [
      {
        "name": "fee_amount",
        "type": "core::integer::u128",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "privacy::events::FeeCollectorSet",
    "kind": "struct",
    "members": [
      {
        "name": "fee_collector",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "privacy::events::ProofValidityBlocksSet",
    "kind": "struct",
    "members": [
      {
        "name": "proof_validity_blocks",
        "type": "core::integer::u64",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "privacy::events::OpenNoteScreeningPolicySet",
    "kind": "struct",
    "members": [
      {
        "name": "depositor",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "key"
      },
      {
        "name": "policy",
        "type": "privacy::objects::OpenNoteScreeningPolicy",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "privacy::privacy::Privacy::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "PausableEvent",
        "type": "starkware_utils::components::pausable::pausable::PausableComponent::Event",
        "kind": "flat"
      },
      {
        "name": "ReplaceabilityEvent",
        "type": "starkware_utils::components::replaceability::replaceability::ReplaceabilityComponent::Event",
        "kind": "flat"
      },
      {
        "name": "CommonRolesEvent",
        "type": "starkware_utils::components::common_roles::common_roles::CommonRolesComponent::Event",
        "kind": "flat"
      },
      {
        "name": "AccessControlEvent",
        "type": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::Event",
        "kind": "flat"
      },
      {
        "name": "SRC5Event",
        "type": "openzeppelin_introspection::src5::SRC5Component::Event",
        "kind": "flat"
      },
      {
        "name": "ReentrancyGuardEvent",
        "type": "openzeppelin_security::reentrancyguard::ReentrancyGuardComponent::Event",
        "kind": "flat"
      },
      {
        "name": "ViewingKeySet",
        "type": "privacy::events::ViewingKeySet",
        "kind": "nested"
      },
      {
        "name": "Withdrawal",
        "type": "privacy::events::Withdrawal",
        "kind": "nested"
      },
      {
        "name": "Deposit",
        "type": "privacy::events::Deposit",
        "kind": "nested"
      },
      {
        "name": "AuditorPublicKeySet",
        "type": "privacy::events::AuditorPublicKeySet",
        "kind": "nested"
      },
      {
        "name": "ScreenerPublicKeySet",
        "type": "privacy::events::ScreenerPublicKeySet",
        "kind": "nested"
      },
      {
        "name": "OpenNoteCreated",
        "type": "privacy::events::OpenNoteCreated",
        "kind": "nested"
      },
      {
        "name": "EncNoteCreated",
        "type": "privacy::events::EncNoteCreated",
        "kind": "nested"
      },
      {
        "name": "OpenNoteDeposited",
        "type": "privacy::events::OpenNoteDeposited",
        "kind": "nested"
      },
      {
        "name": "ExternalContractInvoked",
        "type": "privacy::events::ExternalContractInvoked",
        "kind": "nested"
      },
      {
        "name": "NoteUsed",
        "type": "privacy::events::NoteUsed",
        "kind": "nested"
      },
      {
        "name": "FeeAmountSet",
        "type": "privacy::events::FeeAmountSet",
        "kind": "nested"
      },
      {
        "name": "FeeCollectorSet",
        "type": "privacy::events::FeeCollectorSet",
        "kind": "nested"
      },
      {
        "name": "ProofValidityBlocksSet",
        "type": "privacy::events::ProofValidityBlocksSet",
        "kind": "nested"
      },
      {
        "name": "OpenNoteScreeningPolicySet",
        "type": "privacy::events::OpenNoteScreeningPolicySet",
        "kind": "nested"
      }
    ]
  }
] as const;
