import { Client, ChannelType, TextChannel, Message } from 'discord.js';
import { MessageTracker } from './MessageTracker.ts';

export class HistoryScanner {
    // 48 hours in milliseconds
    private static readonly RETENTION_PERIOD = 48 * 60 * 60 * 1000;
    // Delay between batches to prevent CPU spikes and rate limits
    private static readonly BATCH_DELAY = 1000;
    // Delay between channels
    private static readonly CHANNEL_DELAY = 2000;

    public static async start(client: Client): Promise<void> {
        console.log('📜 [HistoryScanner] Starting background history scan...');
        const tracker = MessageTracker.getInstance();
        const now = Date.now();
        let totalMessagesTracked = 0;

        for (const guild of client.guilds.cache.values()) {
            for (const channel of guild.channels.cache.values()) {
                if (!channel.isTextBased() || channel.type === ChannelType.GuildVoice) continue;

                const textChannel = channel as TextChannel;

                // Skip if bot doesn't have view/history permissions (basic check)
                if (!textChannel.viewable) continue;

                // console.log(`🔍 [HistoryScanner] Scanning ${textChannel.name} (${guild.name})...`);

                let lastId: string | undefined;
                let active = true;
                let countInChannel = 0;

                while (active) {
                    try {
                        const messages = await textChannel.messages.fetch({ limit: 50, before: lastId });

                        if (messages.size === 0) {
                            active = false;
                            break;
                        }

                        for (const msg of messages.values()) {
                            // Check if message is within 48h window
                            if (now - msg.createdTimestamp > this.RETENTION_PERIOD) {
                                active = false; // Stop scanning this channel if we hit old messages
                                continue;
                            }

                            tracker.addMessage(msg.author.id, msg.id, msg.channelId, msg.createdTimestamp);
                            countInChannel++;
                            totalMessagesTracked++;
                            lastId = msg.id;
                        }

                        // Safety break for very active channels (e.g. limit to last 500 msgs to save memory/time)
                        if (countInChannel > 500) active = false;

                        // Throttle within channel
                        if (active) await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));

                    } catch (error) {
                        console.error(`⚠️ [HistoryScanner] Error fetching ${textChannel.name}:`, error);
                        active = false;
                    }
                }

                // Throttle between channels
                await new Promise(resolve => setTimeout(resolve, this.CHANNEL_DELAY));
            }
        }

        console.log(`✅ [HistoryScanner] Scan complete. Tracked ${totalMessagesTracked} historical messages.`);
    }
}
