import { Events, Client } from 'discord.js';
import { HistoryScanner } from '../services/HistoryScanner';

export default {
    name: Events.ClientReady,
    once: true,
    execute(client: Client) {
        console.log(`✅ Logged in as ${client.user?.tag}! Active Tracking System Online.`);

        // Start background history scan
        HistoryScanner.start(client).catch(err => console.error('Failed to start history scanner:', err));
    },
};
