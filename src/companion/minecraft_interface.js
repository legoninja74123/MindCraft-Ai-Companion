import * as world from '../agent/library/world.js';
import * as skills from '../agent/library/skills.js';
import { Vec3 } from 'vec3';
/**
 * MinecraftInterface
 *
 * Clean boundary between the Companion architecture and MindCraft/Mineflayer.
 *
 * Higher-level companion systems should use this class instead of directly
 * interacting with Mineflayer.
 */


export class MinecraftInterface {
    constructor(bot) {
        if (!bot) {
            throw new Error('MinecraftInterface requires a MindCraft bot.');
        }

        this.bot = bot;
    }

    // ============================================================
    // CONNECTION / BASIC STATE
    // ============================================================

    isConnected() {
        return !!this.bot?.entity;
    }

    requireConnected() {
        if (!this.isConnected()) {
            throw new Error('MinecraftInterface: bot is not connected.');
        }
    }

    getPosition() {
        this.requireConnected();
        return world.getPosition(this.bot);
    }

    getHealth() {
        this.requireConnected();
        return this.bot.health;
    }

    getFood() {
        this.requireConnected();
        return this.bot.food;
    }

    getDimension() {
        this.requireConnected();
        return this.bot.game?.dimension ?? null;
    }

    getGameMode() {
        this.requireConnected();
        return this.bot.game?.gameMode ?? null;
    }

    // ============================================================
    // WORLD PERCEPTION
    // ============================================================

    getBlockAt(position) {
        this.requireConnected();

        const normalizedPosition = new Vec3(
            Math.floor(position.x),
            Math.floor(position.y),
            Math.floor(position.z)
        );

        const block = this.bot.blockAt(normalizedPosition);

        if (!block) {
            return null;
        }

        return this.normalizeBlock(block);
    }

    getNearbyBlocks(blockTypes = null, distance = 8, count = 1000) {
        this.requireConnected();

        const blocks = world.getNearestBlocks(
            this.bot,
            blockTypes,
            distance,
            count
        );

        return blocks
            .filter(block => block != null)
            .map(block => this.normalizeBlock(block));
    }

    getSurroundingBlocks() {
        this.requireConnected();

        const blocks = world.getSurroundingBlocks(this.bot);

        return blocks
            .filter(block => block != null)
            .map(block => this.normalizeBlock(block));
    }

    getNearbyEntities(distance = 16) {
        this.requireConnected();

        return world
            .getNearbyEntities(this.bot, distance)
            .map(entity => this.normalizeEntity(entity));
    }

    getNearbyPlayers(distance = 16) {
        this.requireConnected();

        return world
            .getNearbyPlayers(this.bot, distance)
            .map(entity => this.normalizeEntity(entity));
    }

    // ============================================================
    // INVENTORY
    // ============================================================

    getInventory() {
        this.requireConnected();

        return world.getInventoryCounts(this.bot);
    }

    getItemCount(itemName) {
        this.requireConnected();

        const inventory = this.getInventory();
        return inventory[itemName] ?? 0;
    }

    hasItem(itemName, count = 1) {
        return this.getItemCount(itemName) >= count;
    }

    // ============================================================
    // MOVEMENT
    // ============================================================

    async moveTo(position, minDistance = 2) {
        this.requireConnected();

        if (!position) {
            throw new Error('moveTo requires a position.');
        }

        return await skills.goToPosition(
            this.bot,
            position.x,
            position.y,
            position.z,
            minDistance
        );
    }

    async moveToPlayer(username, distance = 3) {
        this.requireConnected();

        if (!username) {
            throw new Error('moveToPlayer requires a username.');
        }

        return await skills.goToPlayer(
            this.bot,
            username,
            distance
        );
    }

    async moveToNearestBlock(blockType, minDistance = 2, range = 64) {
        this.requireConnected();

        if (!blockType) {
            throw new Error('moveToNearestBlock requires a block type.');
        }

        return await skills.goToNearestBlock(
            this.bot,
            blockType,
            minDistance,
            range
        );
    }

    stopMovement() {
        if (!this.bot) {
            return;
        }

        this.bot.pathfinder?.stop();
        this.bot.clearControlStates?.();
    }

    // ============================================================
    // BLOCK ACTIONS
    // ============================================================

    async mine(blockType, count = 1) {
        this.requireConnected();

        if (!blockType) {
            throw new Error('mine requires a block type.');
        }

        if (count < 1) {
            throw new Error('mine count must be at least 1.');
        }

        return await skills.collectBlock(
            this.bot,
            blockType,
            count
        );
    }

    async breakBlock(position) {
        this.requireConnected();

        if (!position) {
            throw new Error('breakBlock requires a position.');
        }

        return await skills.breakBlockAt(
            this.bot,
            position.x,
            position.y,
            position.z
        );
    }

    async placeBlock(
        blockType,
        position,
        placeOn = 'bottom'
    ) {
        this.requireConnected();

        if (!blockType) {
            throw new Error('placeBlock requires a block type.');
        }

        if (!position) {
            throw new Error('placeBlock requires a position.');
        }

        return await skills.placeBlock(
            this.bot,
            blockType,
            position.x,
            position.y,
            position.z,
            placeOn
        );
    }

    // ============================================================
    // CRAFTING / SMELTING
    // ============================================================

    async craft(itemName, count = 1) {
        this.requireConnected();

        if (!itemName) {
            throw new Error('craft requires an item name.');
        }

        if (count < 1) {
            throw new Error('craft count must be at least 1.');
        }

        return await skills.craftRecipe(
            this.bot,
            itemName,
            count
        );
    }

    async smelt(itemName, count = 1) {
        this.requireConnected();

        if (!itemName) {
            throw new Error('smelt requires an item name.');
        }

        if (count < 1) {
            throw new Error('smelt count must be at least 1.');
        }

        return await skills.smeltItem(
            this.bot,
            itemName,
            count
        );
    }

    // ============================================================
    // COMBAT
    // ============================================================

    async attackNearest(entityType, kill = true) {
        this.requireConnected();

        if (!entityType) {
            throw new Error('attackNearest requires an entity type.');
        }

        return await skills.attackNearest(
            this.bot,
            entityType,
            kill
        );
    }

    async defendSelf(range = 9) {
        this.requireConnected();

        return await skills.defendSelf(
            this.bot,
            range
        );
    }

    // ============================================================
    // EQUIPMENT
    // ============================================================

    async equip(itemName) {
        this.requireConnected();

        if (!itemName) {
            throw new Error('equip requires an item name.');
        }

        return await skills.equip(
            this.bot,
            itemName
        );
    }

    // ============================================================
    // COMMUNICATION
    // ============================================================

    chat(message) {
        this.requireConnected();

        if (!message) {
            return;
        }

        this.bot.chat(message);
    }

    // ============================================================
    // NORMALIZATION
    // ============================================================

    normalizeBlock(block) {
        return {
            type: block.name,
            position: {
                x: Math.floor(block.position.x),
                y: Math.floor(block.position.y),
                z: Math.floor(block.position.z)
            }
        };
    }

    normalizeEntity(entity) {
        return {
            id: entity.id ?? null,
            type: entity.name ?? null,
            username: entity.username ?? null,
            position: entity.position
                ? {
                    x: entity.position.x,
                    y: entity.position.y,
                    z: entity.position.z
                }
                : null,
            health: entity.health ?? null
        };
    }
}