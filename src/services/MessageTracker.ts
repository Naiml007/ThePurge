import { Collection } from 'discord.js';

export interface TrackedMessage {
    messageId: string;
    channelId: string;
    timestamp: number;
}

export class MessageTracker {
    private static instance: MessageTracker;
    // Map<UserId, TrackedMessage[]>
    private messages: Map<string, TrackedMessage[]>;
    // 48 hours in milliseconds
    private readonly RETENTION_PERIOD = 48 * 60 * 60 * 1000;
    // Garbage collection interval (1 hour)
    private readonly GC_INTERVAL = 60 * 60 * 1000;

    private constructor() {
        this.messages = new Map();
        this.startGarbageCollection();
    }

    public static getInstance(): MessageTracker {
        if (!MessageTracker.instance) {
            MessageTracker.instance = new MessageTracker();
        }
        return MessageTracker.instance;
    }

    /**
     * Track a new message
     */
    public addMessage(userId: string, messageId: string, channelId: string, timestamp: number = Date.now()): void {
        const userMessages = this.messages.get(userId) || [];

        userMessages.push({
            messageId,
            channelId,
            timestamp
        });

        // Optimization: usage of array push is O(1). 
        // We don't sort here; we assume insertion order is roughly time order.
        this.messages.set(userId, userMessages);
    }

    /**
     * Remove a single message from tracking
     */
    public removeMessage(messageId: string): void {
        for (const [userId, userMessages] of this.messages.entries()) {
            const index = userMessages.findIndex(msg => msg.messageId === messageId);
            if (index !== -1) {
                userMessages.splice(index, 1);
                if (userMessages.length === 0) {
                    this.messages.delete(userId);
                }
                return; // Message found and removed
            }
        }
    }

    /**
     * Remove multiple messages from tracking
     */
    public removeMessages(messageIds: string[]): void {
        const idsToRemove = new Set(messageIds);
        for (const [userId, userMessages] of this.messages.entries()) {
            const filteredMessages = userMessages.filter(msg => !idsToRemove.has(msg.messageId));
            if (filteredMessages.length !== userMessages.length) {
                if (filteredMessages.length === 0) {
                    this.messages.delete(userId);
                } else {
                    this.messages.set(userId, filteredMessages);
                }
            }
        }
    }

    /**
     * Get all tracked messages for a user
     */
    public getMessagesByUser(userId: string): TrackedMessage[] {
        return this.messages.get(userId) || [];
    }

    /**
     * Start the garbage collection interval
     */
    private startGarbageCollection(): void {
        setInterval(() => {
            this.cleanup();
        }, this.GC_INTERVAL);
    }

    /**
     * Remove messages older than 48 hours
     */
    private cleanup(): void {
        const now = Date.now();
        let totalRemoved = 0;

        for (const [userId, userMessages] of this.messages.entries()) {
            // Filter keeping only messages strictly younger than RETENTION_PERIOD
            const validMessages = userMessages.filter(msg => (now - msg.timestamp) < this.RETENTION_PERIOD);

            if (validMessages.length === 0) {
                this.messages.delete(userId);
            } else if (validMessages.length !== userMessages.length) {
                this.messages.set(userId, validMessages);
                totalRemoved += (userMessages.length - validMessages.length);
            }
        }

        // Optional: Log GC results for debugging/monitoring
        // console.log(`[MessageTracker] GC ran. Removed ${totalRemoved} expired messages.`);
    }

    /**
     * Debug method to check memory usage stats
     */
    public getStats(): { userCount: number, totalMessages: number } {
        let totalMessages = 0;
        for (const msgs of this.messages.values()) {
            totalMessages += msgs.length;
        }
        return {
            userCount: this.messages.size,
            totalMessages
        };
    }
}
