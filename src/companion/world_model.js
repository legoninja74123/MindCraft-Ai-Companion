import { getEntityMetadata } from '../utils/mcdata.js';

/**
 * WorldModel
 *
 * Stores what the Companion currently believes about the Minecraft world.
 *
 * This is deliberately separate from MinecraftInterface:
 *
 * MinecraftInterface = "What can I observe right now?"
 * WorldModel         = "What do I currently believe/remember?"
 *
 * The model also preserves block history so that when a block changes,
 * the previous state is not simply forgotten.
 */


export class WorldModel {

    constructor(registry = null) {
        this.registry = registry;

        // Current known block state.
        //
        // key:
        //     "x,y,z"
        //
        // value:
        //     block memory object
        this.blocks = new Map();


        // Known entities.
        this.entities = new Map();


        // Timestamp of the most recent observation.
        this.lastObservation = null;
    }


    // ============================================================
    // POSITION HELPERS
    // ============================================================

    blockKey(position) {
        return [
            Math.floor(position.x),
            Math.floor(position.y),
            Math.floor(position.z)
        ].join(',');
    }

    getEntityMemoryPolicy(entity) {
    
        const name = String(entity?.name ?? entity?.type ?? '')
            .replace(/^minecraft:/i, '')
            .toLowerCase();

        const metadata =
            this.registry?.entitiesByName?.[name] ??
            getEntityMetadata(name);
        

        if (!metadata) {
            return 'unknown';
        }

        const type = String(metadata.type ?? '').toLowerCase();
        const category = String(metadata.category ?? '').toLowerCase();

        if (
            type === 'hostile' ||
            category.includes('hostile')
        ) {
            return 'hostile';
        }

        if (category.includes('neutral')) {
            return 'retaliatory';
        }

        if (
            type === 'animal' ||
            type === 'passive' ||
            type === 'water_creature' ||
            type === 'ambient' ||
            category.includes('passive')
        ) {
            return 'peaceful';
        }

        return 'unknown';
    }


    // ============================================================
    // BLOCK OBSERVATION
    // ============================================================

    observeBlock(block, options = {}) {

        if (!block || !block.position) {
            return null;
        }

        const now = Date.now();

        const position = {
            x: Math.floor(block.position.x),
            y: Math.floor(block.position.y),
            z: Math.floor(block.position.z)
        };

        const type = block.type ?? block.name;

        if (!type) {
            return null;
        }

        const key = this.blockKey(position);

        const existing = this.blocks.get(key);


        // --------------------------------------------------------
        // NEW BLOCK
        // --------------------------------------------------------

        if (!existing) {

            const memory = {

                position,

                type,

                firstSeen: now,
                lastSeen: now,
                validity: 'valid',

                // Historical block states.
                previousTypes: [],

                confidence:
                    options.confidence ?? 1.0,

                source:
                    options.source ?? 'direct'
            };

            this.blocks.set(key, memory);

            return {
                status: 'NEW',
                block: memory
            };
        }


        // --------------------------------------------------------
        // UNCHANGED BLOCK
        // --------------------------------------------------------

        if (existing.type === type) {

            existing.lastSeen = now;

            existing.validity = 'valid';

            existing.confidence =
                options.confidence ?? 1.0;

            existing.source =
                options.source ?? 'direct';

            return {
                status: 'UNCHANGED',
                block: existing
            };
        }


        // --------------------------------------------------------
        // CHANGED BLOCK
        // --------------------------------------------------------

        const previousType = existing.type;

        existing.previousTypes.push({
            type: previousType,
            changedAt: now
        });

        existing.type = type;
        existing.lastSeen = now;
        existing.validity = 'valid';

        existing.confidence =
            options.confidence ?? 1.0;

        existing.source =
            options.source ?? 'direct';


        return {
            status: 'CHANGED',

            previousType,

            block: existing
        };
    }


    observeBlocks(blocks, options = {}) {

        const results = [];

        for (const block of blocks ?? []) {

            const result =
                this.observeBlock(block, options);

            if (result) {
                results.push(result);
            }
        }

        this.lastObservation = Date.now();

        return results;
    }


    // ============================================================
    // ENTITY OBSERVATION
    // ============================================================

    observeEntity(entity, options = {}) {

        if (!entity || entity.id == null) {
            return null;
        }

        const now = Date.now();

        const memoryPolicy =
            options.memoryPolicy ??
            this.getEntityMemoryPolicy(entity);

        const existing = this.entities.get(entity.id);

        const observation = {

            id: entity.id,

            name: entity.name ?? null,

            type: entity.type ?? null,

            username: entity.username ?? null,

            memoryPolicy,

            position: entity.position
                ? {
                    x: entity.position.x,
                    y: entity.position.y,
                    z: entity.position.z
                }
                : null,

            lastSeen: now,

            confidence:
                options.confidence ?? 1.0,

            source:
                options.source ?? 'direct'
        };


        if (!existing) {

            observation.firstSeen = now;

            observation.previousPositions = [];

            this.entities.set(
                entity.id,
                observation
            );

            return {
                status: 'NEW',
                entity: observation
            };
        }


        // Preserve previous position when the entity moves.

        const retainPositionHistory =
            memoryPolicy === 'hostile' ||
            memoryPolicy === 'retaliatory';

        if (
            retainPositionHistory &&
            existing.position &&
            observation.position &&
            (
                existing.position.x !== observation.position.x ||
                existing.position.y !== observation.position.y ||
                existing.position.z !== observation.position.z
            )
        ) {
            existing.previousPositions.push({
                position: { ...existing.position },
                observedAt: now
            });

            // Keep only the most recent 10 previous positions.
            if (existing.previousPositions.length > 10) {
                existing.previousPositions.shift();
            }
        }


        existing.name = observation.name;
        existing.type = observation.type;
        existing.username = observation.username;
        existing.memoryPolicy = memoryPolicy;
        existing.position = observation.position;
        existing.lastSeen = now;

        existing.confidence =
            options.confidence ??
            existing.confidence;

        existing.source =
            options.source ??
            existing.source;


        return {
            status: 'UPDATED',
            entity: existing
        };
    }


    observeEntities(entities, options = {}) {

        const results = [];

        for (const entity of entities ?? []) {

            const result =
                this.observeEntity(entity, options);

            if (result) {
                results.push(result);
            }
        }

        return results;
    }


    getEntityMemoryStatus(id, staleAfterMs = 30000, hostileTimeoutMs = 120000) {
        const entity = this.getEntity(id);

        if (!entity) {
            return 'UNKNOWN';
        }

        const age = Date.now() - entity.lastSeen;

        if (age <= staleAfterMs) {
            return 'RECENTLY_SEEN';
        }

        if (
            entity.memoryPolicy === 'hostile' &&
            age >= hostileTimeoutMs
        ) {
            return 'PRESUMED_DESPAWNED';
        }

        return 'NOT_RECENTLY_SEEN';
    }


    // ============================================================
    // BLOCK RETRIEVAL
    // ============================================================

    getBlock(position) {

        return (
            this.blocks.get(
                this.blockKey(position)
            ) ?? null
        );
    }

    getCurrentBlock(position) {
        const block = this.getBlock(position);

        if (!block || block.validity !== 'valid') {
            return null;
        }

        return block;
    }

    getBlockHistory(position) {

        const block =
            this.getBlock(position);

        if (!block) {
            return null;
        }

        return {

            position: {
                ...block.position
            },

            currentType:
                block.type,
            
            validity:
                block.validity,

            previousTypes:
                block.previousTypes.map(
                    entry => ({ ...entry })
                ),

            firstSeen:
                block.firstSeen,

            lastSeen:
                block.lastSeen,

            confidence:
                block.confidence,

            source:
                block.source
        };
    }


    getPreviousTypes(position) {

        const block =
            this.getBlock(position);

        if (!block) {
            return [];
        }

        return block.previousTypes.map(
            entry => entry.type
        );
    }

    getBlockFreshness(position, staleAfterMs = 30000) {
        const block = this.getBlock(position);

        if (!block) {
            return 'UNKNOWN';
        }

        if (block.validity === 'invalidated') {
            return 'INVALIDATED';
        }

        const age = Date.now() - block.lastSeen;

        return age <= staleAfterMs
            ? 'FRESH'
            : 'STALE';
    }


    getBlocks() {

        return Array.from(
            this.blocks.values()
        );
    }


    getBlocksByType(type) {

        return this.getBlocks()
            .filter(block =>
                block.type === type
            );
    }


    getEntities() {

        return Array.from(
            this.entities.values()
        );
    }


    getEntity(id) {

        return this.entities.get(id) ?? null;
    }


    // ============================================================
    // INVALIDATION
    // ============================================================

    forgetCurrentObservation(position) {

        const block =
            this.getBlock(position);

        if (!block) {
            return false;
        }

        block.validity = 'invalidated';
        block.confidence = 0;
        block.source = 'invalidated';

        return true;
    }


    // ============================================================
    // MAINTENANCE
    // ============================================================

    clear() {

        this.blocks.clear();
        this.entities.clear();

        this.lastObservation = null;
    }


    getSummary() {

        return {

            knownBlocks:
                this.blocks.size,

            knownEntities:
                this.entities.size,

            lastObservation:
                this.lastObservation
        };
    }
}