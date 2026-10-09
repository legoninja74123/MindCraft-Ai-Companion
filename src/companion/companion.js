import { MinecraftInterface } from './minecraft_interface.js';
import { WorldModel } from './world_model.js';
import { EventManager } from './event_manager.js';
import { GoalManager } from './goal_manager.js';
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
    constructor(bot) {
        if (!bot) {
            throw new Error('Companion requires a Minecraft bot.');
        }

        this.minecraft = new MinecraftInterface(bot);
        this.worldModel = new WorldModel(bot.registry);
        this.eventManager = new EventManager({ threatRange: 6 });
        this.goalManager = new GoalManager();
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

        return {
            ...observation,
            events
        };
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
            goals: this.goalManager.getState()
        };
    }
}