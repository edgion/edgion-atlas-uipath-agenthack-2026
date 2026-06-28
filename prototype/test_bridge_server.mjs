import assert from "node:assert/strict";
import { createBridgeServer } from "./workflow_bridge_server.mjs";

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json();
  return { response, body };
}

const bridge = createBridgeServer({
  idGenerator: () => "run-http-001",
  now: () => "2026-06-27T19:00:00.000Z",
  uipathEnv: {},
});
const { server, url } = await bridge.listen(0);

try {
  const health = await jsonFetch(`${url}/api/health`);
  assert.equal(health.response.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.uipath.mode, "local");
  assert.equal(health.body.uipath.configured, false);

  const created = await jsonFetch(`${url}/api/workflow/cases`, {
    method: "POST",
    body: JSON.stringify({
      selectedSourceIds: ["external_physical_risk_signal", "screening_level_spatial_hazard_context"],
      activeScenario: "storm",
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.caseId, "TVDC01-2026-REVIEW");
  assert.equal(created.body.workflowRunId, "run-http-001");
  assert.equal(created.body.bridgeStage, "case_intake");

  const workup = await jsonFetch(`${url}/api/workflow/cases/TVDC01-2026-REVIEW/workup`, { method: "POST" });
  assert.equal(workup.response.status, 200);
  assert.equal(workup.body.bridgeStage, "run_specialist_workup");
  assert.equal(workup.body.professionalWorkup.selectedSourceCount, 2);

  const request = await jsonFetch(`${url}/api/workflow/cases/TVDC01-2026-REVIEW/evidence-requests`, {
    method: "POST",
    body: JSON.stringify({ taskId: "site_asset_basis" }),
  });
  assert.equal(request.response.status, 200);
  assert.deepEqual(request.body.createdEvidenceRequestIds, ["site_asset_basis"]);

  const action = await jsonFetch(`${url}/api/workflow/cases/TVDC01-2026-REVIEW/human-action`, {
    method: "POST",
    body: JSON.stringify({
      selectedActionId: "keep_under_review",
      reviewerNote: "Keep open until site evidence returns.",
      evidenceOwner: "Asset owner",
    }),
  });
  assert.equal(action.response.status, 200);
  assert.equal(action.body.selectedActionId, "keep_under_review");

  const finalPayload = await jsonFetch(`${url}/api/workflow/cases/TVDC01-2026-REVIEW/final-payload`);
  assert.equal(finalPayload.response.status, 200);
  assert.equal(finalPayload.body.workflowRunId, "run-http-001");
  assert.equal(finalPayload.body.decisionRecord.selectedActionId, "keep_under_review");
  assert.equal(finalPayload.body.uipathBridgePayload.queueItem.specificContent.workflowRunId, "run-http-001");

  const submit = await jsonFetch(`${url}/api/workflow/cases/TVDC01-2026-REVIEW/uipath-submit`, { method: "POST" });
  assert.equal(submit.response.status, 200);
  assert.equal(submit.body.uipath.mode, "local");
  assert.equal(submit.body.uipath.submitted, false);
  assert.equal(submit.body.uipath.reason, "UIPATH_ORCHESTRATOR_URL or UIPATH_ACCESS_TOKEN is not configured");
  assert.equal(submit.body.payload.queueItem.reference, "TVDC01-2026-REVIEW");

  const staticIndex = await fetch(`${url}/`);
  assert.equal(staticIndex.status, 200);
  assert.match(await staticIndex.text(), /Professional Review Workflow/);
} finally {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

console.log("bridge server tests passed");
