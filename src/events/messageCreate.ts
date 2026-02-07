import { Events, Message } from 'discord.js';
import { MessageTracker } from '../services/MessageTracker';

export default {
    name: Events.MessageCreate,
    execute(message: Message) {
        // Ignore bots to save memory and prevent loops
        if (message.author.bot) return;

        // Ignore DM channels (undefined guild)? user said "single server", 
        // usually purge is for guild. Bot needs to be able to delete.
        if (!message.guild || !message.channel.id) return;

        const tracker = MessageTracker.getInstance();
        tracker.addMessage(message.author.id, message.id, message.channel.id);
    },
};
