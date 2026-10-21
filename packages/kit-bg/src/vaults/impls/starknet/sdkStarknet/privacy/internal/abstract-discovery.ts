import type { BlockIdentifier } from "starknet";
import type {
  Channel,
  DiscoveryProviderInterface,
  Note,
  StarknetAddressBigint,
  ViewingKey,
} from "../interfaces";
import { SetupRequirement } from "../interfaces";
import { AddressMap } from "../utils/maps";
import type { ChannelCursor, NotesCursor, RecipientsFilter } from "./channel";

export abstract class AbstractDiscoveryProvider implements DiscoveryProviderInterface {
  // Abstract methods that subclasses must implement
  abstract discoverNotes(
    address: StarknetAddressBigint,
    viewingKey: ViewingKey,
    params?: {
      since?: BlockIdentifier;
      known?: AddressMap<Note[]>;
      tokens?: StarknetAddressBigint[];
      blockIdentifier?: BlockIdentifier;
    }
  ): Promise<{
    timestamp: BlockIdentifier;
    notes: AddressMap<Note[]>;
    cursor: NotesCursor;
  }>;

  abstract discoverChannels(
    address: StarknetAddressBigint,
    viewingKey: ViewingKey,
    recipients: RecipientsFilter,
    params?: { cursor?: ChannelCursor; blockIdentifier?: BlockIdentifier }
  ): Promise<{ timestamp: BlockIdentifier; channels?: AddressMap<Channel>; total?: number }>;

  // Default implementation provided by the abstract class
  async discoverRequirement(
    address: StarknetAddressBigint,
    viewingKey: ViewingKey,
    recipient: StarknetAddressBigint,
    token: StarknetAddressBigint
  ): Promise<SetupRequirement> {
    const { channels } = await this.discoverChannels(address, viewingKey, [recipient]);
    const channel = channels?.get(recipient);
    return channel?.toSetupRequirement(token) ?? SetupRequirement.Register;
  }
}
