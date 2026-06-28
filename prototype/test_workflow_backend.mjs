import assert from "node:assert/strict";
import { createWorkflowBackend } from "./workflow_backend.mjs";
import { caseData } from "./data.mjs";

const backend = createWorkflowBackend({
  idGenerator: () => "run-test-001",
  now: () => "2026-06-27T18:00:00.000Z",
});

const created = backend.createCase(caseData, {
  selectedSourceIds: ["external_physical_risk_signal", "site_resilience_notes"],
  activeScenario: "water",
});

assert.equal(created.caseId, "TVDC01-2026-REVIEW");
assert.equal(created.workflowRunId, "run-test-001");
assert.equal(created.status, "case_created");
assert.equal(created.bridgeStage, "case_intake");
assert.equal(created.queueItem.reference, "TVDC01-2026-REVIEW");
assert.equal(created.queueItem.specificContent.workflowRunId, "run-test-001");
assert.equal(created.queueItem.specificContent.sourceCount, 2);

const workup = backend.runWorkup(created.caseId);
assert.equal(workup.caseId, created.caseId);
assert.equal(workup.workflowRunId, "run-test-001");
assert.equal(workup.status, "workup_prepared");
assert.equal(workup.bridgeStage, "run_specialist_workup");
assert.equal(workup.professionalWorkup.selectedSourceCount, 2);
assert.equal(workup.executionPlan.evidenceTasks.length, 6);

const request = backend.createEvidenceRequest(created.caseId, "site_asset_basis");
assert.equal(request.caseId, created.caseId);
assert.equal(request.workflowRunId, "run-test-001");
assert.equal(request.status, "evidence_request_created");
assert.equal(request.bridgeStage, "create_review_task");
assert.deepEqual(request.createdEvidenceRequestIds, ["site_asset_basis"]);

assert.throws(
  () => backend.createEvidenceRequest(created.caseId, "not_a_real_task"),
  /Unknown evidence task/,
);

const humanAction = backend.captureHumanAction(created.caseId, {
  selectedActionId: "refer_risk_engineering",
  reviewerNote: "Site evidence requested; risk engineering should review when evidence returns.",
  evidenceOwner: "Risk engineering",
});
assert.equal(humanAction.caseId, created.caseId);
assert.equal(humanAction.workflowRunId, "run-test-001");
assert.equal(humanAction.status, "human_action_captured");
assert.equal(humanAction.bridgeStage, "capture_reviewer_action");
assert.equal(humanAction.selectedActionId, "refer_risk_engineering");

const finalPayload = backend.getFinalPayload(created.caseId);
assert.equal(finalPayload.workflowRunId, "run-test-001");
assert.equal(finalPayload.runtime.currentStage, "generate_decision_record");
assert.equal(finalPayload.executionPlan.createdEvidenceRequestCount, 1);
assert.equal(finalPayload.decisionRecord.selectedActionId, "refer_risk_engineering");
assert.equal(finalPayload.backendState.status, "decision_record_ready");
assert.equal(finalPayload.backendState.history.length, 5);
assert.equal(finalPayload.uipathBridgePayload.queueItem.reference, "TVDC01-2026-REVIEW");
assert.equal(finalPayload.uipathBridgePayload.queueItem.specificContent.workflowRunId, "run-test-001");
assert.equal(finalPayload.uipathBridgePayload.specificContent.workflowRunId, "run-test-001");
assert.equal(finalPayload.uipathBridgePayload.specificContent.selectedActionId, "refer_risk_engineering");

const stored = backend.getCase(created.caseId);
assert.equal(stored.workflowRunId, "run-test-001");
assert.equal(stored.status, "decision_record_ready");
assert.deepEqual(
  stored.history.map((entry) => entry.event),
  ["case_created", "workup_prepared", "evidence_request_created", "human_action_captured", "final_payload_generated"],
);

assert.throws(() => backend.getCase("missing-case"), /Unknown case/);

console.log("redesign workflow backend tests passed");
