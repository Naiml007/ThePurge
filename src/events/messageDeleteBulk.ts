import { Events, Collection, Message, type PartialMessage, type Snowflake } from 'discord.js';
import { MessageTracker } from '../services/MessageTracker';

export default {
    name: Events.MessageBulkDelete,
    execute(messages: Collection<Snowflake, Message | PartialMessage>) {
        const tracker = MessageTracker.getInstance();
        // Convert collection keys (message IDs) to array
        const messageIds = Array.from(messages.keys());
        tracker.removeMessages(messageIds);

        console.log(`[MessageTracker] Bulk delete detected. Removed ${messageIds.length} messages from tracker.`);
    },
};
