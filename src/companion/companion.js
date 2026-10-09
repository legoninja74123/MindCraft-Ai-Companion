import { MinecraftInterface } from './minecraft_interface.js';
import { WorldModel } from './world_model.js';
import { EventManager } from './event_manager.js';
import { AttentionManager } from './attention_manager.js';
import { GoalManager } from './goal_manager.js';
import { InterruptionManager } from './interruption_manager.js';
/**
 * Companion
 *
 * Root object for the new Companion architecture.
 *
 * This is intentionally small right now.
 *
 * Later this becomes the home for:
 *
 *   perception
 *   world model
 *   attention
 *   goals
 *   memory
 *   knowledge
 *   skills
 *   cognition
 *   personality
 *   relationship
 *   safety
 *   communication
 */
export class Companion {
    constructor(bot, executionStateProvider = null) {
        if (!bot) {
            throw new Error('Companion requires a Minecraft bot.');
        }

        this.executionStateProvider = executionStateProvider;
        this.minecraft = new MinecraftInterface(bot);
        this.worldModel = new WorldModel(bot.registry);
        this.eventManager = new EventManager({ threatRange: 6 });
        this.interruptionManager = new InterruptionManager();
        this.attentionManager = new AttentionManager();
        this.goalManager = new GoalManager();

        // The latest attention decision, for inspection and debugging.
        this.currentAttention = null;
    }

    observeNearby(distance = 8, count = 1000) {
        const blocks = this.minecraft.getNearbyBlocks(
            null,
            distance,
            count
        );

        const entities = this.minecraft.getNearbyEntities(distance);

        const blockResults = this.worldModel.observeBlocks(blocks);
        const entityResults = this.worldModel.observeEntities(entities);

        const observation = {
            blocks: blockResults,
            entities: entityResults
        };

        const events = this.eventManager.process(
            observation,
            this.minecraft.getPosition()
        );

        for (const event of events) {
            this.interruptionManager.beginInterruption(
                event,
                this.goalManager.getActiveGoal(),
                this.goalManager.getActiveSubgoal()
            );
        }

        // Connect observed world events and persistent objectives
        // to the deterministic attention selector.
        this.currentAttention = this.attentionManager.selectFocus({
            events,
            activeGoal: this.goalManager.getActiveGoal(),
            activeSubgoal: this.goalManager.getActiveSubgoal()
        });

        return {
            ...observation,
            events,
            attention: this.currentAttention
        };
    }

    acknowledgeAttentionEvent(eventId) {
        return this.attentionManager.acknowledgeEvent(eventId);
    }

    getExecutionState() {
        if (!this.executionStateProvider) {
            return {
                status: 'UNKNOWN',
                executing: null,
                actionLabel: null,
                modeName: null,
                isSurvivalResponse: false
            };
        }

        return this.executionStateProvider();
    }

    getState() {
        return {
            connected: this.minecraft.isConnected(),
            position: this.minecraft.getPosition(),
            health: this.minecraft.getHealth(),
            food: this.minecraft.getFood(),
            dimension: this.minecraft.getDimension(),
            gameMode: this.minecraft.getGameMode(),
            inventory: this.minecraft.getInventory(),
            worldModel: this.worldModel.getSummary(),
            execution: this.getExecutionState(),
            goals: this.goalManager.getState(),
            interruptions: this.interruptionManager.getState(),
            attention: this.currentAttention,
            pendingAttentionEvents:
                this.attentionManager.getPendingEvents()
        };
    }
}