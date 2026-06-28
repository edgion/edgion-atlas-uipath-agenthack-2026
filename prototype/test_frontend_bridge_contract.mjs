import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("./app.mjs", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("./index.html", import.meta.url), "utf8");

assert.match(indexHtml, /id="workflow-bridge-host"/);
assert.match(appSource, /const workflowBridge/);
assert.match(appSource, /async function ensureWorkflowCase/);
assert.match(appSource, /async function runBridgeWorkup/);
assert.match(appSource, /async function createBridgeEvidenceRequest/);
assert.match(appSource, /async function captureBridgeHumanAction/);
assert.match(appSource, /async function refreshBridgeFinalPayload/);
assert.match(appSource, /\/api\/workflow\/cases/);
assert.match(appSource, /\/workup/);
assert.match(appSource, /\/evidence-requests/);
assert.match(appSource, /\/human-action/);
assert.match(appSource, /\/final-payload/);
assert.match(appSource, /Orchestrated workflow/);
assert.match(appSource, /Workflow trail/);
assert.match(appSource, /workflowRunId/);
assert.doesNotMatch(appSource, /Send to UiPath/i);
assert.doesNotMatch(indexHtml, /Send to UiPath/i);

console.log("frontend bridge contract tests passed");
