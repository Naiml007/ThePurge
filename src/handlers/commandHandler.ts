import { Client, Routes, REST, Collection } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import type { Command } from '../types';

export const commands = new Collection<string, Command>();

export async function loadCommands(client: Client) {
    const commandsPath = join(__dirname, '../commands');
    const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

    const commandsData = [];

    for (const file of commandFiles) {
        const filePath = join(commandsPath, file);
        const commandModule = await import(filePath);
        const command: Command = commandModule.default || commandModule;

        if ('data' in command && 'execute' in command) {
            commands.set((command.data as any).name, command);
            commandsData.push((command.data as any).toJSON());
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }

    // Register commands
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);

    try {
        console.log(`Started refreshing ${commandsData.length} application (/) commands.`);

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID!),
            { body: commandsData },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}
