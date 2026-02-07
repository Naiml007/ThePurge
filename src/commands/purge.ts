import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, TextChannel, MessageFlags } from 'discord.js';
import { MessageTracker } from '../services/MessageTracker';
import type { Command } from '../types';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Globally purge messages from a specific user (Last 48 hours).')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user whose messages to delete')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (Optional)')
                .setMinValue(1))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction: ChatInputCommandInteraction) {
        const targetUser = interaction.options.getUser('target', true);

        // Check for specific role requirement
        const allowedRoleId = process.env.ALLOWED_ROLE_ID;
        if (allowedRoleId) {
            const member = interaction.member;
            let hasRole = false;

            if (member) {
                if (Array.isArray(member.roles)) {
                    hasRole = member.roles.includes(allowedRoleId);
                } else {
                    // @ts-ignore - types are tricky with APIInteractionGuildMember, but cache exists on GuildMember
                    hasRole = member.roles.cache?.has(allowedRoleId);
                }
            }

            if (!hasRole) {
                await interaction.reply({ content: '❌ You do not have permission to use this command!', flags: MessageFlags.Ephemeral });
                return;
            }
        }

        // Security: Ensure bot has permissions in current channel at least (global check done per channel)
        if (!interaction.guild?.members.me?.permissions.has(PermissionFlagsBits.ManageMessages)) {
            await interaction.reply({ content: '❌ I do not have Manage Messages permission!', flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const tracker = MessageTracker.getInstance();
        const amount = interaction.options.getInteger('amount');
        let trackedMessages = tracker.getMessagesByUser(targetUser.id);

        if (amount) {
            trackedMessages = trackedMessages.slice(-amount); // Get the most recent N messages
        }

        if (trackedMessages.length === 0) {
            await interaction.editReply(`✅ No active messages found for ${targetUser} in the last 48 hours.`);
            return;
        }

        // Group messages by channelId
        const messagesByChannel = new Map<string, string[]>();
        for (const msg of trackedMessages) {
            if (!messagesByChannel.has(msg.channelId)) {
                messagesByChannel.set(msg.channelId, []);
            }
            messagesByChannel.get(msg.channelId)?.push(msg.messageId);
        }

        let totalDeleted = 0;
        let channelsProcessed = 0;
        const totalChannels = messagesByChannel.size;

        // Iterate and purge
        for (const [channelId, messageIds] of messagesByChannel.entries()) {
            try {
                const channel = await interaction.guild?.channels.fetch(channelId) as TextChannel;

                // Permission and Type Check
                if (!channel || !channel.isTextBased() || !channel.permissionsFor(interaction.guild!.members.me!)?.has(PermissionFlagsBits.ManageMessages)) {
                    console.warn(`[Purge] Skipped channel ${channelId}: Missing permissions or invalid channel.`);
                    continue; // Skip if cant delete
                }

                // Chunking logic handled by Discord.js bulkDelete mostly, 
                // but strictly speaking bulkDelete takes max 100.
                // We should chunk manually to be safe.
                for (let i = 0; i < messageIds.length; i += 100) {
                    const batch = messageIds.slice(i, i + 100);
                    // Filter out messages older than 14 days explicitly just in case tracker has old data (GC should handle, but API errors if >14d)
                    // Note: bulkDelete(activeMessages, true) usually filters old ones but won't throw. 
                    // However, we are passing IDs. passing IDs relies on Discord validation.
                    // The safer way is to let bulkDelete handle it or check timestamps if we had them (we track timestamps).
                    // We'll trust the tracker references <= 48h.

                    try {
                        const deleted = await channel.bulkDelete(batch, true);
                        totalDeleted += deleted.size;
                    } catch (error: any) {
                        // Ignore "Unknown Message" (code 10008) - they are already deleted
                        if (error.code === 10008) {
                            console.warn(`[Purge] Encountered Unknown Message error in ${channelId}. Some messages were likely already deleted.`);
                            // We can't easily know how many "succeeded" if the whole batch failed, 
                            // but bulkDelete usually throws if *any* fails validation in a certain way?
                            // Actually bulkDelete with filterOld=true shouldn't throw for old messages, 
                            // but for Unknown Message it might.
                            // If it fails, we assume we couldn't delete this batch or they are gone.
                        } else {
                            throw error; // Re-throw other errors to be caught by outer loop
                        }
                    }
                }

                channelsProcessed++;

                // Rate Limit Protection: Sleep 200ms
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.error(`[Purge] Failed to delete in channel ${channelId}:`, error);
                // Continue to next channel
            }
        }

        await interaction.editReply(
            `✅ Global Purge Complete for ${targetUser}.\n` +
            `🗑️ **${totalDeleted}** messages deleted.\n` +
            `📂 **${channelsProcessed}/${totalChannels}** active channels processed.`
        );
    },
};

export default command;
