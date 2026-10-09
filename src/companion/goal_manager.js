
/**
 * GoalManager
 *
 * Stores persistent goals and their sequential subgoals.
 * Proposals remain separate until explicitly approved.
 * This module does not execute Minecraft actions.
 */
export class GoalManager {
    constructor() {
        this.goals = new Map();
        this.proposals = new Map();
        this.nextGoalId = 1;
        this.nextProposalId = 1;
        this.activeGoalId = null;
    }

    createGoal(description, options = {}) {
        if (typeof description !== 'string' || !description.trim()) {
            throw new Error('Goal description must be a non-empty string.');
        }

        const id = this.nextGoalId++;
        const goal = {
            id,
            description: description.trim(),
            source: options.source ?? 'player',
            status: this.activeGoalId === null ? 'active' : 'queued',
            subgoals: [],
            createdAt: Date.now()
        };

        this.goals.set(id, goal);

        if (goal.status === 'active') {
            this.activeGoalId = id;
        }

        return goal;
    }

    proposeGoal(description, options = {}) {
        if (typeof description !== 'string' || !description.trim()) {
            throw new Error('Proposal description must be a non-empty string.');
        }

        const id = this.nextProposalId++;
        const proposal = {
            id,
            description: description.trim(),
            reason: options.reason ?? null,
            status: 'pending',
            createdAt: Date.now()
        };

        this.proposals.set(id, proposal);
        return proposal;
    }

    approveProposal(proposalId) {
        const proposal = this.proposals.get(proposalId);

        if (!proposal || proposal.status !== 'pending') {
            return null;
        }

        proposal.status = 'approved';

        return this.createGoal(proposal.description, {
            source: 'approved_proposal'
        });
    }

    rejectProposal(proposalId) {
        const proposal = this.proposals.get(proposalId);

        if (!proposal || proposal.status !== 'pending') {
            return false;
        }

        proposal.status = 'rejected';
        return true;
    }

    addSubgoal(goalId, description) {
        const goal = this.goals.get(goalId);

        if (!goal || !['active', 'queued', 'paused'].includes(goal.status)) {
            return null;
        }

        if (typeof description !== 'string' || !description.trim()) {
            throw new Error('Subgoal description must be a non-empty string.');
        }

        const subgoal = {
            id: goal.subgoals.length + 1,
            description: description.trim(),
            status: 'pending',
            createdAt: Date.now()
        };

        goal.subgoals.push(subgoal);
        return subgoal;
    }

    getActiveGoal() {
        if (this.activeGoalId === null) return null;
        return this.goals.get(this.activeGoalId) ?? null;
    }

    getActiveSubgoal() {
        const goal = this.getActiveGoal();

        if (!goal) return null;

        return goal.subgoals.find(
            subgoal => subgoal.status === 'active'
        ) ?? null;
    }

    startNextSubgoal(goalId = this.activeGoalId) {
        const goal = this.goals.get(goalId);

        if (!goal || goal.status !== 'active') return null;

        // Never start a second subgoal while one is active.
        const current = goal.subgoals.find(
            subgoal => subgoal.status === 'active'
        );

        if (current) return current;

        const next = goal.subgoals.find(
            subgoal => subgoal.status === 'pending'
        );

        if (next) {
            next.status = 'active';
        }

        return next ?? null;
    }

    completeSubgoal(goalId, subgoalId) {
        const goal = this.goals.get(goalId);
        if (!goal || goal.status !== 'active') return false;

        const subgoal = goal.subgoals.find(
            item => item.id === subgoalId
        );

        if (!subgoal || subgoal.status !== 'active') return false;

        subgoal.status = 'completed';
        subgoal.completedAt = Date.now();
        return true;
    }

    failSubgoal(goalId, subgoalId, reason = null) {
        const goal = this.goals.get(goalId);
        if (!goal || goal.status !== 'active') return false;

        const subgoal = goal.subgoals.find(
            item => item.id === subgoalId
        );

        if (!subgoal || subgoal.status !== 'active') return false;

        subgoal.status = 'failed';
        subgoal.failureReason = reason;
        subgoal.failedAt = Date.now();
        return true;
    }

    
    retrySubgoal(goalId, subgoalId) {
        const goal = this.goals.get(goalId);

        // Retries are only allowed within the active goal.
        if (!goal || goal.status !== 'active') return false;

        const subgoal = goal.subgoals.find(
            item => item.id === subgoalId
        );

        // Only an explicitly failed subgoal can be retried.
        if (!subgoal || subgoal.status !== 'failed') return false;

        subgoal.status = 'pending';
        delete subgoal.failureReason;
        delete subgoal.failedAt;

        return true;
    }

    pauseGoal(goalId = this.activeGoalId) {
        const goal = this.goals.get(goalId);

        if (!goal || goal.status !== 'active') return false;

        goal.status = 'paused';
        this.activeGoalId = null;
        return true;
    }

    resumeGoal(goalId) {
        const goal = this.goals.get(goalId);

        if (
            !goal ||
            goal.status !== 'paused' ||
            this.activeGoalId !== null
        ) {
            return false;
        }

        goal.status = 'active';
        this.activeGoalId = goalId;
        return true;
    }

    completeGoal(goalId = this.activeGoalId) {
        const goal = this.goals.get(goalId);

        if (!goal || goal.status !== 'active') return false;

        // A goal with subgoals cannot complete while any remain unfinished.
        const unfinished = goal.subgoals.some(
            subgoal => subgoal.status !== 'completed'
        );

        if (unfinished) return false;

        goal.status = 'completed';
        goal.completedAt = Date.now();
        this.activeGoalId = null;
        this.activateNextQueuedGoal();
        return true;
    }

    failGoal(goalId = this.activeGoalId, reason = null) {
        const goal = this.goals.get(goalId);

        if (!goal || goal.status !== 'active') return false;

        goal.status = 'failed';
        goal.failureReason = reason;
        goal.failedAt = Date.now();
        this.activeGoalId = null;
        this.activateNextQueuedGoal();
        return true;
    }

    activateNextQueuedGoal() {
        const next = [...this.goals.values()].find(
            goal => goal.status === 'queued'
        );

        if (!next) return null;

        next.status = 'active';
        this.activeGoalId = next.id;
        return next;
    }

    getGoal(goalId) {
        return this.goals.get(goalId) ?? null;
    }

    getProposal(proposalId) {
        return this.proposals.get(proposalId) ?? null;
    }

    getState() {
        return {
            activeGoal: this.getActiveGoal(),
            activeSubgoal: this.getActiveSubgoal(),
            goals: [...this.goals.values()],
            proposals: [...this.proposals.values()]
        };
    }

    clear() {
        this.goals.clear();
        this.proposals.clear();
        this.nextGoalId = 1;
        this.nextProposalId = 1;
        this.activeGoalId = null;
    }
}