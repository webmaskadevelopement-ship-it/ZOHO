/**
 * Visual Blueprint State Machine Engine
 * Validates state transitions, before-transition guards, during-transition prompts,
 * and executes automated post-actions.
 */

class BlueprintEngine {
    /**
     * Validates whether a transition is permitted
     */
    static validateTransition({
        blueprint,
        currentStateId,
        targetStateId,
        userRole,
        itemData,
        inputPrompts = {}
    }) {
        if (!blueprint) {
            // No blueprint attached, transitions allowed
            return { allowed: true };
        }

        const transitions = typeof blueprint.transitions === 'string'
            ? JSON.parse(blueprint.transitions || '[]')
            : (blueprint.transitions || []);

        // Find transition definition
        const transition = transitions.find(
            t => (t.fromStateId === currentStateId || t.fromState === currentStateId) &&
                 (t.toStateId === targetStateId || t.toState === targetStateId)
        );

        if (!transition) {
            return {
                allowed: false,
                error: `Transition from state "${currentStateId}" to "${targetStateId}" is not allowed in blueprint "${blueprint.name}".`
            };
        }

        // 1. Check Role Guards
        if (transition.allowedRoles && transition.allowedRoles.length > 0) {
            if (!transition.allowedRoles.includes(userRole) && userRole !== 'admin') {
                return {
                    allowed: false,
                    error: `Role "${userRole}" is not authorized to execute transition "${transition.name}".`
                };
            }
        }

        // 2. Check Before Criteria / Preconditions
        if (transition.beforeCriteria) {
            if (transition.beforeCriteria.requireAllChecklistsCompleted) {
                const checklists = typeof itemData.checklist_items === 'string'
                    ? JSON.parse(itemData.checklist_items || '[]')
                    : (itemData.checklist_items || []);

                const uncompleted = checklists.filter(c => !c.checked);
                if (uncompleted.length > 0) {
                    return {
                        allowed: false,
                        error: `Cannot transition: ${uncompleted.length} checklist item(s) are not yet completed.`
                    };
                }
            }

            if (transition.beforeCriteria.requireNoOpenIssues) {
                // If checking related issues
                if (itemData.openIssuesCount > 0) {
                    return {
                        allowed: false,
                        error: 'Cannot transition: open linked issues remain unresolved.'
                    };
                }
            }
        }

        // 3. Check During Prompts (Mandatory fields input by user)
        if (transition.duringPrompts && transition.duringPrompts.length > 0) {
            for (const prompt of transition.duringPrompts) {
                if (prompt.required && (!inputPrompts[prompt.field] || inputPrompts[prompt.field].trim() === '')) {
                    return {
                        allowed: false,
                        error: `Mandatory prompt "${prompt.label || prompt.field}" is required to complete this transition.`
                    };
                }
            }
        }

        return {
            allowed: true,
            transition
        };
    }

    /**
     * Executes automated post-actions after transition
     */
    static executePostActions(transition, item, inputPrompts = {}, db = null) {
        if (!transition || !transition.postActions) return {};

        const updates = {};
        for (const action of transition.postActions) {
            if (action.type === 'set_field') {
                updates[action.field] = action.value;
            } else if (action.type === 'set_completion') {
                updates.completion_percentage = action.value;
                if (action.value === 100) {
                    updates.is_completed = 1;
                    updates.is_closed_type = 1;
                }
            }
        }

        return updates;
    }
}

module.exports = BlueprintEngine;
