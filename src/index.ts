import { Client, GatewayIntentBits } from 'discord.js';
import { loadCommands } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';
import { MessageTracker } from './services/MessageTracker';

// Load environment variables (Bun does this automatically contextually, but good to be explicit if using dotenv, 
// strictly speaking Bun.env or process.env works)
const { TOKEN } = process.env;

if (!TOKEN) {
    throw new Error("Missing TOKEN in environment variables");
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});

// Initialize Tracker
MessageTracker.getInstance();

// Load Handlers
(async () => {
    await loadCommands(client);
    await loadEvents(client);

    await client.login(TOKEN);
})();
