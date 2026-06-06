import { Action, ToolContext, ToolResult, ProposalResult, AIDisabledError, AILevelError, WorkspaceAIConfig } from './types';
import { findAction } from './registry';
import { findWriteOp } from './writeOps/registry';

/**
 * Dispatch and level-gate the action proposing step. Enforces the action's `allow`
 * write-op manifest, stripping any disallowed proposals before returning.
 */
export async function runTool(
  actionId: string,
  input: unknown,
  ctx: ToolContext,
  ai: WorkspaceAIConfig
): Promise<ToolResult<ProposalResult>> {
  if (!ai || ai.level === 0) {
    throw new AIDisabledError();
  }
  const action = findAction(actionId);
  if (!action) {
    throw new Error(`Unknown action: ${actionId}`);
  }
  if (action.level > ai.level) {
    throw new AILevelError(`${action.id} requires Level ${action.level}; workspace is Level ${ai.level}.`);
  }

  try {
    const result = await action.propose(input, ctx);

    // Normalization & Gating check against action.allow manifest
    let filteredResult = result;
    if (result.type === 'proposals') {
      const allowedProposals = result.list.filter((prop) => {
        const isAllowed = action.allow.includes(prop.op);
        if (!isAllowed) {
          console.warn(`Action "${actionId}" proposed disallowed write-op "${prop.op}" (omitted).`);
        }
        return isAllowed;
      });
      filteredResult = { type: 'proposals', list: allowedProposals };
    } else if (result.type === 'text' && result.suggestedOp) {
      const isAllowed = action.allow.includes(result.suggestedOp.op);
      if (!isAllowed) {
        console.warn(`Action "${actionId}" proposed disallowed suggested write-op "${result.suggestedOp.op}" (omitted).`);
        filteredResult = { type: 'text', text: result.text };
      }
    }

    return {
      ok: true,
      output: filteredResult,
      warnings: [],
    };
  } catch (err: unknown) {
    return {
      ok: false,
      warnings: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Validates, level-gates, and executes a specific write-op proposal.
 * This is the deterministic executor that performs snapshots and writes changes.
 */
export async function executeWriteOp(
  opId: string,
  args: unknown,
  ctx: ToolContext,
  ai: WorkspaceAIConfig
): Promise<void> {
  if (!ai || ai.level === 0) {
    throw new AIDisabledError();
  }
  const op = findWriteOp(opId);
  if (!op) {
    throw new Error(`Unknown write-op: ${opId}`);
  }
  if (op.level > ai.level) {
    throw new AILevelError(`${op.id} requires Level ${op.level}; workspace is Level ${ai.level}.`);
  }

  // Validate the payload argument shape
  const valRes = op.validate(args);
  if (!valRes.ok) {
    throw new Error(`Invalid arguments for write-op "${opId}": ${valRes.error}`);
  }

  // Execute the write-op
  await op.execute(valRes.value, ctx);
}
