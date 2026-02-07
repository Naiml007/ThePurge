import { Events, Message, type PartialMessage } from 'discord.js';
import { MessageTracker } from '../services/MessageTracker';

export default {
    name: Events.MessageDelete,
    execute(message: Message | PartialMessage) {
        const tracker = MessageTracker.getInstance();
        tracker.removeMessage(message.id);
    },
};
