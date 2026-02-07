import { ChatInputCommandInteraction, Client, SlashCommandBuilder } from 'discord.js';

export interface Command {
    data: SlashCommandBuilder | unknown; // unknown to allow flexible builder types
    execute: (interaction: ChatInputCommandInteraction, client?: Client) => Promise<void>;
}
