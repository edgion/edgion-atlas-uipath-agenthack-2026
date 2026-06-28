import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildDecisionRecord,
  buildHazardEvidenceInterpretation,
  buildOperatorGuide,
  buildProfessionalWorkupPayload,
  buildQueueItem,
  buildReviewActions,
  buildWorkupExecutionPlan,
  buildSourceRows,
  buildSpatialWorkup,
  buildHumanReviewTask,
  buildUiPathWorkflowPayload,
  buildWorkflowStages,
  buildWorkflowSteps,
  buildSpecialistPipelineState,
  buildSpecialistPipelineTiming,
  buildSpecialistWaitingState,
  getMustShowSections,
} from "./core.mjs";
import { caseData as demoCaseData } from "./data.mjs";

const indexHtml = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const appSource = readFileSync(new URL("./app.mjs", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
assert.match(indexHtml, /<h1>Professional Review Workflow<\/h1>/);
assert.match(indexHtml, /styles\.css\?v=processed-hazard-map-21/);
assert.match(indexHtml, /<button class="brand-home" type="button" data-view="case" aria-label="Go to workflow home">/);
assert.match(indexHtml, /app\.mjs\?v=processed-hazard-map-21/);
assert.match(indexHtml, /leaflet@1\.9\.4\/dist\/leaflet\.css/);
assert.match(indexHtml, /leaflet@1\.9\.4\/dist\/leaflet\.js/);
assert.doesNotMatch(indexHtml, /class="nav-button active"/);
assert.doesNotMatch(indexHtml, /<h1>Review Workspace<\/h1>/);
assert.doesNotMatch(indexHtml, /<h1>Data-centre physical-risk work-up<\/h1>/);
assert.doesNotMatch(indexHtml, /Case-to-record review prototype for UiPath AgentHack MVP/);
assert.doesNotMatch(indexHtml, /class="case-context-line"/);
assert.doesNotMatch(indexHtml, /Thames Valley DC-01 · UK Data Centre Portfolio · Flood \/ Heat \/ Wind/);
assert.doesNotMatch(indexHtml, /class="demo-case-strip"/);

const inputsGuide = buildOperatorGuide("inputs");
assert.equal(inputsGuide.instruction, "Confirm the information for review.");
assert.equal(inputsGuide.description, "Check the selected information before continuing.");
assert.equal(inputsGuide.action, "none");

const enterpriseWorkflowPayload = buildUiPathWorkflowPayload(demoCaseData, {
  selectedSourceIds: ["external_physical_risk_signal", "site_resilience_notes"],
  activeScenario: "water",
  selectedActionId: "request_site_evidence",
  createdTaskIds: ["site_asset_basis"],
});
assert.equal(enterpriseWorkflowPayload.queueItem.queueName, "DataCentrePhysicalRiskReview");
assert.equal(enterpriseWorkflowPayload.queueItem.specificContent.queueReferenceId, "TVDC01-2026-REVIEW");
assert.equal(enterpriseWorkflowPayload.queueItem.specificContent.workflowState, "case_intake_created");
assert.equal(enterpriseWorkflowPayload.queueItem.specificContent.slaHours, 48);
assert.equal(enterpriseWorkflowPayload.executionPlan.enterpriseControls.retryPolicy.maxAttempts, 2);
assert.equal(enterpriseWorkflowPayload.executionPlan.enterpriseControls.escalationPath[0].stage, "evidence_missing_after_sla");
assert.equal(enterpriseWorkflowPayload.executionPlan.evidenceTasks[0].retry.maxAttempts, 2);
assert.equal(enterpriseWorkflowPayload.executionPlan.evidenceTasks[0].escalationOwner, "Portfolio risk lead");
assert.equal(enterpriseWorkflowPayload.humanTask.integrationMode, "human_task_model");
assert.equal(enterpriseWorkflowPayload.humanTask.productBoundary, "Modeled human review task; not a live Action Center task in this MVP package.");
assert.equal(enterpriseWorkflowPayload.auditOutput.recordType, "workflow_decision_packet");
assert.ok(Array.isArray(enterpriseWorkflowPayload.auditOutput.eventHistory));
assert.deepEqual(
  enterpriseWorkflowPayload.auditOutput.eventHistory.map((event) => event.event),
  [
    "queue_created",
    "source_pack_loaded",
    "workup_completed",
    "evidence_request_created",
    "human_action_captured",
    "decision_packet_generated",
  ],
);
assert.ok(enterpriseWorkflowPayload.auditOutput.stageStatus);
assert.equal(enterpriseWorkflowPayload.auditOutput.stageStatus.evidenceRequest.status, "created");
assert.deepEqual(enterpriseWorkflowPayload.auditOutput.stageStatus.evidenceRequest.createdEvidenceRequestIds, [
  "site_asset_basis",
]);
assert.equal(enterpriseWorkflowPayload.auditOutput.stageStatus.humanAction.selectedActionId, "request_site_evidence");
assert.deepEqual(
  enterpriseWorkflowPayload.auditOutput.payloadSections,
  ["queueItem", "professionalWorkup", "executionPlan", "humanTask", "decisionRecord"],
);
assert.ok(enterpriseWorkflowPayload.stages.some((stage) => stage.id === "evidence_incomplete_retry_or_escalate"));

const submissionPayloadSample = JSON.parse(
  readFileSync(new URL("../uipath/sample_payload.json", import.meta.url), "utf8"),
);
assert.equal(submissionPayloadSample.executionPlan.createdEvidenceRequestCount, 1);
assert.deepEqual(submissionPayloadSample.executionPlan.createdEvidenceRequestIds, ["site_asset_basis"]);
assert.equal(submissionPayloadSample.executionPlan.evidenceTasks[0].status, "Request created");
assert.equal(submissionPayloadSample.humanTask.inputRecord.createdEvidenceRequestCount, 1);
assert.deepEqual(submissionPayloadSample.humanTask.inputRecord.createdEvidenceRequestIds, ["site_asset_basis"]);
assert.equal(submissionPayloadSample.decisionRecord.evidenceContext.createdEvidenceRequestCount, 1);
assert.deepEqual(submissionPayloadSample.decisionRecord.evidenceContext.createdEvidenceRequestIds, ["site_asset_basis"]);
assert.deepEqual(submissionPayloadSample.auditOutput.createdEvidenceRequestIds, ["site_asset_basis"]);
assert.equal(submissionPayloadSample.auditOutput.stageStatus.evidenceRequest.status, "created");
assert.deepEqual(submissionPayloadSample.auditOutput.stageStatus.evidenceRequest.createdEvidenceRequestIds, [
  "site_asset_basis",
]);

assert.match(appSource, /Ready to Continue/);
assert.match(appSource, /data-hazard-map/);
assert.match(appSource, /hazard-layers\/manifest\.json/);
assert.match(appSource, /data-hazard-layer-toggle/);
assert.match(appSource, /source_attribution/);
assert.match(appSource, /initEmbeddedHazardMap/);
assert.match(appSource, /Processed hazard-layer map/);
assert.match(appSource, /hazardAssetVersion\s*=\s*"processed-hazard-map-21"/);
assert.match(appSource, /hazardAssetPath\(layer\.files\.visual_png\s*\?\?\s*layer\.files\.png\)/);
assert.match(appSource, /wind_pgw_etc_proxy:\s*0\.92/);
assert.match(appSource, /rain_pgw_etc_proxy:\s*0\.9/);
assert.doesNotMatch(appSource, /display_png/);
assert.match(appSource, /class="layer-panel"/);
assert.match(appSource, /Physical-risk layers/);
assert.match(appSource, /Evidence overlays/);
assert.match(appSource, /hazardLayerControls/);
assert.match(appSource, /hazardInitialView/);
assert.match(appSource, /setView\(hazardInitialView\.center,\s*hazardInitialView\.zoom\)/);
assert.match(appSource, /data-hazard-map-control="reset"/);
assert.match(appSource, /data-hazard-map-control="zoom-in"/);
assert.match(appSource, /data-hazard-map-control="zoom-out"/);
assert.match(appSource, /embeddedHazardMap\.zoomIn\(1\)/);
assert.match(appSource, /embeddedHazardMap\.zoomOut\(1\)/);
assert.doesNotMatch(appSource, /window\.L\.control\.zoom/);
assert.doesNotMatch(appSource, /fitBounds\(hazardMapBounds/);
assert.match(appSource, /Flood: UK river RP100 depth/);
assert.match(appSource, /hazard-layer-content/);
assert.match(appSource, /hazard-colorbar/);
assert.match(appSource, /hazard-layer-source/);
assert.match(appSource, /hazard-source-note/);
assert.match(appSource, /Source: JRC\/CEMS Global River Flood Hazard Maps · screening layer · not site-level evidence/);
assert.match(appSource, /Source: Synthetic proxy · screening layer · not site-level evidence/);
assert.doesNotMatch(appSource, /hazard-source-chip/);
assert.match(appSource, /Flood: EA Zone 3 extent/);
assert.match(appSource, /Heat: GLA heat risk/);
assert.match(appSource, /Wildfire danger: EFFIS FWI/);
assert.match(appSource, /Wind: storm footprint proxy/);
assert.match(appSource, /Rain: rainfall footprint proxy/);
assert.match(appSource, /hazardDisplayName/);
assert.doesNotMatch(appSource, /PGW ETC/);
assert.doesNotMatch(appSource, /source:\s*"MPAS PGW"/);
assert.doesNotMatch(appSource, /data-hazard-current-source>MPAS PGW/);
assert.match(appSource, /Water stress: WRI Aqueduct/);
assert.equal((appSource.match(/defaultChecked:\s*true/g) || []).length, 1);
assert.match(appSource, /data-evidence-overlay-toggle/);
assert.match(appSource, /processed-hazard-overlays/);
assert.match(appSource, /data-hazard-overlay/);
assert.match(appSource, /review-mini-map-context/);
assert.match(appSource, /review-mini-map-frame/);
assert.match(appSource, /review-mini-map-frame[\s\S]*map-utility-controls/);
assert.match(appSource, /Human review task model/);
assert.doesNotMatch(appSource, /Action Center task/);
assert.doesNotMatch(appSource, /<section class="atlas review-map-atlas"/);
assert.match(appSource, /Thames Valley DC-01/);
assert.match(appSource, /window\.L\.map/);
assert.match(appSource, /includes\("gla"\)/);
assert.match(appSource, /includes\("ea_zone"\)/);
assert.doesNotMatch(appSource, /includes\("ea"\)/);
assert.doesNotMatch(appSource, /embedded-hazard-panel/);
assert.doesNotMatch(appSource, /embedded-hazard-status/);
assert.doesNotMatch(appSource, /embedded-hazard-legend/);
assert.doesNotMatch(appSource, /class="map-svg"/);
assert.doesNotMatch(appSource, /aria-label="Synthetic data-centre physical-risk map"/);
assert.match(appSource, /Ready to continue/);
assert.match(appSource, /sources checked/);
assert.match(appSource, /Ready for review preparation/);
assert.match(appSource, /Confirmation recorded/);
assert.match(appSource, /Selected information/);
assert.match(appSource, /Checked/);
assert.match(appSource, /5 sources ready|sources ready/);
assert.match(appSource, /Prepare review package/);
assert.match(appSource, /Review requirements met/);
assert.match(appSource, /Source details/);
assert.doesNotMatch(appSource, /Evidence Package Review/);
assert.doesNotMatch(appSource, /Recommended evidence package ready/);
assert.doesNotMatch(appSource, /Evidence Readiness Gate/);
assert.doesNotMatch(appSource, /Professional work-up prepared/);
assert.doesNotMatch(appSource, /Human decision gate/);
assert.match(appSource, /Review decision/);
assert.match(appSource, /Evidence trail/);
assert.match(appSource, /Audit-ready record/);
assert.match(appSource, /recordJsonOpen:\s*false/);
assert.match(appSource, /Technical payload/);
assert.match(appSource, /JSON payload available for downstream workflow handoff/);
assert.match(appSource, /Download JSON/);
assert.match(appSource, /data-toggle-record-json/);
assert.match(appSource, /Show payload/);
assert.match(appSource, /Hide payload/);
assert.match(appSource, /String\(index \+ 1\)\.padStart\(2, "0"\)/);
assert.doesNotMatch(appSource, /Exportable JSON/);
assert.doesNotMatch(appSource, /<h3>Exportable JSON<\/h3>/);
assert.match(appSource, /function renderStepHero\(/);
assert.doesNotMatch(appSource, /function renderOperatorGuide\(/);
assert.match(appSource, /view === "workup" \? "" : renderStepHero\(view\)/);
assert.match(appSource, /\$\{renderStepHero\("workup", \{ runState \}\)\}/);
assert.match(appSource, /class="step-hero operator-guide"/);
assert.match(appSource, /function renderWorkflowSidebar\(/);
assert.match(appSource, /const workflowSteps = buildWorkflowSteps\(activeView, currentWorkflowStepState\(\)\)/);
assert.match(appSource, /step\.sidebarLabel/);
assert.match(appSource, /data-workflow-status="\$\{escapeHtml\(step\.status\)\}"/);
assert.doesNotMatch(appSource, /classList\.toggle\("active", button\.dataset\.view === view\)/);

const finalHierarchyCss = stylesSource.match(
  /\/\* Inputs and work-up hierarchy final pass \*\/[\s\S]*?\/\* End inputs and work-up hierarchy final pass \*\//,
);
assert.ok(finalHierarchyCss, "Inputs/work-up hierarchy final pass CSS block is missing.");
assert.match(finalHierarchyCss[0], /\.case-context-line[\s\S]*font-size:\s*13px[\s\S]*font-weight:\s*400/);
assert.match(finalHierarchyCss[0], /\.workflow-step-number[\s\S]*font-size:\s*13px[\s\S]*font-weight:\s*500/);
assert.match(finalHierarchyCss[0], /\.workflow-step-copy > span[\s\S]*font-size:\s*14px[\s\S]*font-weight:\s*600/);
assert.match(finalHierarchyCss[0], /\.workflow-step-copy strong[\s\S]*font-size:\s*11px[\s\S]*font-weight:\s*400/);
assert.match(finalHierarchyCss[0], /\.operator-guide strong[\s\S]*font-size:\s*14px/);
assert.match(finalHierarchyCss[0], /\.operator-guide p[\s\S]*font-size:\s*13px/);
assert.match(finalHierarchyCss[0], /\.evidence-readiness h3[\s\S]*font-size:\s*18px/);
assert.doesNotMatch(finalHierarchyCss[0], /font-size:\s*(?:17|19)px/);

const finalHeaderCss = stylesSource.match(
  /\/\* Final header and workflow typography fix \*\/[\s\S]*?\/\* End final header and workflow typography fix \*\//,
);
assert.ok(finalHeaderCss, "Final header/workflow typography CSS block is missing.");
assert.match(finalHeaderCss[0], /\.topbar h1[\s\S]*font-size:\s*26px[\s\S]*font-weight:\s*600[\s\S]*line-height:\s*34px[\s\S]*letter-spacing:\s*-0\.01em/);
assert.match(finalHeaderCss[0], /\.topbar[\s\S]*margin-bottom:\s*18px/);
assert.match(finalHeaderCss[0], /\.workflow-step-number[\s\S]*font-size:\s*13px[\s\S]*font-weight:\s*500[\s\S]*line-height:\s*16px/);
assert.match(finalHeaderCss[0], /\.workflow-step-copy > span[\s\S]*font-size:\s*15px[\s\S]*font-weight:\s*600[\s\S]*line-height:\s*18px/);
assert.match(finalHeaderCss[0], /\.workflow-step-copy strong[\s\S]*font-size:\s*11px[\s\S]*font-weight:\s*400[\s\S]*line-height:\s*14px/);
assert.match(finalHeaderCss[0], /\.workflow-step-copy[\s\S]*gap:\s*5px/);

const headerHarmonyCss = stylesSource.match(
  /\/\* Header workflow harmony pass \*\/[\s\S]*?\/\* End header workflow harmony pass \*\//,
);
assert.ok(headerHarmonyCss, "Header workflow harmony CSS block is missing.");
assert.match(headerHarmonyCss[0], /\.workflow-host[\s\S]*margin-bottom:\s*22px/);
assert.match(headerHarmonyCss[0], /\.workflow-host \.workflow-strip[\s\S]*font-family:\s*Inter/);
assert.match(headerHarmonyCss[0], /\.workflow-host \.workflow-step[\s\S]*font-family:\s*Inter[\s\S]*opacity:\s*0\.86/);
assert.match(headerHarmonyCss[0], /\.workflow-host \.workflow-step\.active[\s\S]*opacity:\s*1/);
assert.match(headerHarmonyCss[0], /\.workflow-host \.workflow-step-copy > span[\s\S]*letter-spacing:\s*-0\.005em/);

const inputsTypographyCss = stylesSource.match(
  /\/\* Inputs typography hierarchy audit \*\/[\s\S]*?\/\* End inputs typography hierarchy audit \*\//,
);
assert.ok(inputsTypographyCss, "Inputs typography hierarchy audit CSS block is missing.");
assert.doesNotMatch(inputsTypographyCss[0], /font-size:\s*(?:12|13|15|17|18|19)px/);
assert.match(inputsTypographyCss[0], /\.section-heading h2[\s\S]*font-size:\s*20px/);
assert.match(inputsTypographyCss[0], /\.evidence-readiness h3[\s\S]*font-size:\s*16px/);
assert.match(inputsTypographyCss[0], /\.flow-step h3[\s\S]*font-size:\s*16px/);
assert.match(inputsTypographyCss[0], /\.flow-step p[\s\S]*font-size:\s*14px[\s\S]*line-height:\s*22px/);
assert.match(inputsTypographyCss[0], /\.evidence-recommendation p[\s\S]*font-size:\s*14px[\s\S]*line-height:\s*22px/);
assert.match(inputsTypographyCss[0], /\.evidence-readiness \.eyebrow[\s\S]*font-size:\s*11px[\s\S]*letter-spacing:\s*0\.08em/);

const inputsRhythmCss = stylesSource.match(
  /\/\* Inputs visual rhythm repair \*\/[\s\S]*?\/\* End inputs visual rhythm repair \*\//,
);
assert.ok(inputsRhythmCss, "Inputs visual rhythm repair CSS block is missing.");
assert.match(inputsRhythmCss[0], /\.evidence-readiness h2[\s\S]*font-size:\s*16px[\s\S]*line-height:\s*24px/);
assert.match(inputsRhythmCss[0], /\.evidence-readiness h3[\s\S]*font-size:\s*13px[\s\S]*line-height:\s*18px[\s\S]*font-weight:\s*500/);
assert.match(inputsRhythmCss[0], /\.evidence-recommendation h3[\s\S]*font-size:\s*16px[\s\S]*line-height:\s*24px/);
assert.match(inputsRhythmCss[0], /\.evidence-decision-action[\s\S]*grid-template-columns:\s*auto auto/);
assert.match(inputsRhythmCss[0], /\.evidence-decision-action strong[\s\S]*font-size:\s*13px[\s\S]*font-weight:\s*500[\s\S]*white-space:\s*nowrap/);
assert.match(inputsRhythmCss[0], /\.evidence-decision-action button[\s\S]*font-family:\s*Inter/);

const professionalPolishCss = stylesSource.match(
  /\/\* Professional visual polish pass \*\/[\s\S]*?\/\* End professional visual polish pass \*\//,
);
assert.ok(professionalPolishCss, "Professional visual polish CSS block is missing.");
assert.match(professionalPolishCss[0], /border:\s*1px solid rgba\(17,\s*24,\s*39,\s*0\.06\)/);
assert.match(professionalPolishCss[0], /box-shadow:\s*0 8px 24px rgba\(15,\s*23,\s*42,\s*0\.04\)/);
assert.match(professionalPolishCss[0], /\.evidence-readiness h3[\s\S]*border-radius:\s*999px[\s\S]*height:\s*22px/);
assert.match(professionalPolishCss[0], /\.evidence-readiness h3::before[\s\S]*content:\s*"✓"/);
assert.match(professionalPolishCss[0], /\.evidence-readiness li[\s\S]*min-height:\s*36px/);
assert.match(professionalPolishCss[0], /\.evidence-decision-action button[\s\S]*min-width:\s*236px[\s\S]*font-weight:\s*600/);
assert.match(professionalPolishCss[0], /\.evidence-package-flow[\s\S]*overflow:\s*hidden/);
assert.match(professionalPolishCss[0], /\.flow-step:not\(:last-child\)[\s\S]*border-right:\s*1px solid rgba\(17,\s*24,\s*39,\s*0\.06\)/);

const premiumArtDirectionCss = stylesSource.match(
  /\/\* Premium visual polish v2 art direction pass \*\/[\s\S]*?\/\* End premium visual polish v2 art direction pass \*\//,
);
assert.ok(premiumArtDirectionCss, "Premium visual polish v2 CSS block is missing.");
assert.match(premiumArtDirectionCss[0], /\.operator-guide\[data-active-view="inputs"\][\s\S]*grid-template-columns:\s*minmax\(0,\s*720px\)\s*auto/);
assert.match(premiumArtDirectionCss[0], /\.operator-guide\[data-active-view="inputs"\][\s\S]*box-shadow:\s*0 22px 60px rgba\(15,\s*23,\s*42,\s*0\.06\)/);
assert.match(premiumArtDirectionCss[0], /\.operator-guide\[data-active-view="inputs"\] strong[\s\S]*font-size:\s*20px[\s\S]*line-height:\s*28px/);
assert.match(premiumArtDirectionCss[0], /\.evidence-readiness > div[\s\S]*display:\s*grid[\s\S]*max-width:\s*760px/);
assert.match(premiumArtDirectionCss[0], /\.evidence-readiness h3[\s\S]*order:\s*2/);
assert.match(premiumArtDirectionCss[0], /\.evidence-readiness h2[\s\S]*order:\s*3[\s\S]*font-size:\s*20px/);
assert.match(premiumArtDirectionCss[0], /\.evidence-package-flow::before[\s\S]*height:\s*1px[\s\S]*background:\s*linear-gradient/);
assert.match(premiumArtDirectionCss[0], /\.flow-step:nth-child\(3\)[\s\S]*box-shadow:\s*inset 0 0 0 1px rgba\(173,\s*85,\s*78,\s*0\.10\)/);
assert.match(premiumArtDirectionCss[0], /\.evidence-decision-action button[\s\S]*min-width:\s*260px[\s\S]*box-shadow:\s*0 10px 24px rgba\(173,\s*85,\s*78,\s*0\.08\)/);
assert.match(premiumArtDirectionCss[0], /\.workflow-host \.workflow-step\.pending[\s\S]*opacity:\s*0\.48/);

const inputsScreenshotReferenceCss = stylesSource.match(
  /\/\* Inputs screenshot reference match current palette \*\/[\s\S]*?\/\* End inputs screenshot reference match current palette \*\//,
);
assert.ok(inputsScreenshotReferenceCss, "Inputs screenshot reference match CSS block is missing.");
assert.match(inputsScreenshotReferenceCss[0], /--inputs-ref-accent:\s*#ad554e/);
assert.match(inputsScreenshotReferenceCss[0], /\.workflow-host \.workflow-step-number[\s\S]*width:\s*38px[\s\S]*height:\s*38px[\s\S]*border-radius:\s*999px/);
assert.match(inputsScreenshotReferenceCss[0], /\.workflow-host \.workflow-step\.complete \.workflow-step-number[\s\S]*background:\s*var\(--inputs-ref-accent\)/);
assert.match(inputsScreenshotReferenceCss[0], /\.workflow-host \.workflow-step\.active \.workflow-step-number[\s\S]*box-shadow:\s*0 0 0 4px rgba\(173,\s*85,\s*78,\s*0\.10\)/);
assert.match(inputsScreenshotReferenceCss[0], /\.evidence-readiness h3::before[\s\S]*width:\s*8px[\s\S]*height:\s*8px[\s\S]*border-radius:\s*999px/);
assert.match(inputsScreenshotReferenceCss[0], /\.evidence-decision-action button[\s\S]*background:\s*linear-gradient\(180deg,\s*rgba\(173,\s*85,\s*78,\s*0\.94\),\s*#934943\)/);
assert.doesNotMatch(stylesSource, /body\[data-active-view="inputs"\]\s+\.operator-guide\[data-active-view="inputs"\]::(?:before|after)/);

const globalEvidenceSystemCss = stylesSource.match(
  /\/\* Global evidence design system \*\/[\s\S]*?\/\* End global evidence design system \*\//,
);
assert.ok(globalEvidenceSystemCss, "Global evidence design system CSS block is missing.");
assert.doesNotMatch(globalEvidenceSystemCss[0], /body\[data-active-view="inputs"\]/);
assert.match(globalEvidenceSystemCss[0], /--global-evidence-accent:\s*#ad554e/);
assert.match(globalEvidenceSystemCss[0], /\.sidebar[\s\S]*background:\s*rgba\(250,\s*250,\s*247,\s*0\.96\)/);
assert.match(globalEvidenceSystemCss[0], /\.nav-button\.active[\s\S]*background:\s*rgba\(173,\s*85,\s*78,\s*0\.07\)/);
assert.match(globalEvidenceSystemCss[0], /\.workflow-host \.workflow-strip[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
assert.match(globalEvidenceSystemCss[0], /\.workflow-host \.workflow-step[\s\S]*grid-template-columns:\s*38px minmax\(0,\s*1fr\)/);
assert.match(globalEvidenceSystemCss[0], /\.workflow-host \.workflow-step-number[\s\S]*width:\s*38px[\s\S]*height:\s*38px[\s\S]*border-radius:\s*999px/);
assert.match(globalEvidenceSystemCss[0], /\.workflow-host \.workflow-step\.complete \.workflow-step-number[\s\S]*background:\s*var\(--global-evidence-accent\)/);
assert.match(globalEvidenceSystemCss[0], /\.workflow-host \.workflow-step\.active \.workflow-step-number[\s\S]*box-shadow:\s*0 0 0 4px rgba\(173,\s*85,\s*78,\s*0\.10\)/);
assert.match(globalEvidenceSystemCss[0], /\.workflow-host \.workflow-step-copy > span[\s\S]*font-size:\s*15px[\s\S]*font-weight:\s*600/);
assert.match(globalEvidenceSystemCss[0], /\.workflow-specialist-dots i\.filled[\s\S]*background:\s*var\(--global-evidence-accent\)/);

const globalStepHeroCss = stylesSource.match(
  /\/\* Global StepHero component \*\/[\s\S]*?\/\* End global StepHero component \*\//,
);
assert.ok(globalStepHeroCss, "Global StepHero CSS block is missing.");
assert.doesNotMatch(globalStepHeroCss[0], /body\[data-active-view=/);
assert.match(globalStepHeroCss[0], /\.step-hero\.operator-guide[\s\S]*min-height:\s*96px/);
assert.match(globalStepHeroCss[0], /\.step-hero\.operator-guide[\s\S]*border-left:\s*4px solid var\(--global-evidence-accent\)/);
assert.match(globalStepHeroCss[0], /\.step-hero\.operator-guide[\s\S]*padding:\s*24px 28px/);
assert.match(globalStepHeroCss[0], /\.step-hero\.operator-guide::before[\s\S]*display:\s*none/);
assert.match(globalStepHeroCss[0], /\.step-hero\.operator-guide::after[\s\S]*display:\s*none/);
assert.match(globalStepHeroCss[0], /\.step-hero-label[\s\S]*font-size:\s*11px[\s\S]*letter-spacing:\s*0\.08em/);
assert.match(globalStepHeroCss[0], /\.step-hero-title[\s\S]*font-size:\s*14px[\s\S]*font-weight:\s*600/);
assert.match(globalStepHeroCss[0], /\.step-hero-description[\s\S]*font-size:\s*13px[\s\S]*line-height:\s*20px/);
assert.match(globalStepHeroCss[0], /\.step-hero-action[\s\S]*height:\s*40px[\s\S]*border-radius:\s*6px/);

const globalNavigationWorkflowCss = stylesSource.match(
  /\/\* Global navigation workflow sync \*\/[\s\S]*?\/\* End global navigation workflow sync \*\//,
);
assert.ok(globalNavigationWorkflowCss, "Global navigation workflow sync CSS block is missing.");
assert.match(globalNavigationWorkflowCss[0], /\.workflow-nav \.nav-button\.complete[\s\S]*color:\s*var\(--global-evidence-accent-dark\)/);
assert.match(globalNavigationWorkflowCss[0], /\.workflow-nav \.nav-button\.active[\s\S]*background:\s*rgba\(173,\s*85,\s*78,\s*0\.07\)/);
assert.match(globalNavigationWorkflowCss[0], /\.nav-step-state[\s\S]*width:\s*16px[\s\S]*font-size:\s*11px/);

const decisionAuditPolishCss = stylesSource.match(
  /\/\* Decision record quiet audit polish \*\/[\s\S]*?\/\* End decision record quiet audit polish \*\//,
);
assert.ok(decisionAuditPolishCss, "Decision record quiet audit polish CSS block is missing.");
assert.match(decisionAuditPolishCss[0], /\.record-card\.boundary[\s\S]*border-left:\s*3px solid rgba\(173,\s*85,\s*78,\s*0\.42\)/);
assert.match(decisionAuditPolishCss[0], /\.record-card\.boundary::before[\s\S]*content:\s*"BOUNDARY"/);
assert.match(decisionAuditPolishCss[0], /\.trace-step span[\s\S]*background:\s*rgba\(173,\s*85,\s*78,\s*0\.08\)/);
assert.match(decisionAuditPolishCss[0], /\.trace-step span[\s\S]*border:\s*1px solid rgba\(173,\s*85,\s*78,\s*0\.22\)/);
assert.doesNotMatch(decisionAuditPolishCss[0], /var\(--warning\)|#10231d|#8c5b1f/);

const brandHomeLinkCss = stylesSource.match(
  /\/\* Brand home link \*\/[\s\S]*?\/\* End brand home link \*\//,
);
assert.ok(brandHomeLinkCss, "Brand home link CSS block is missing.");
assert.match(brandHomeLinkCss[0], /\.brand-home[\s\S]*background:\s*transparent/);
assert.match(brandHomeLinkCss[0], /\.brand-home[\s\S]*cursor:\s*pointer/);

const embeddedHazardMapCss = stylesSource.match(
  /\/\* Embedded processed hazard map original ATLAS layout \*\/[\s\S]*?\/\* End embedded processed hazard map original ATLAS layout \*\//,
);
assert.ok(embeddedHazardMapCss, "Embedded processed hazard map CSS block is missing.");
assert.match(embeddedHazardMapCss[0], /\.embedded-hazard-map/);
assert.match(embeddedHazardMapCss[0], /\.hazard-layer-toggle/);
assert.match(embeddedHazardMapCss[0], /\.hazard-layer-content/);
assert.match(embeddedHazardMapCss[0], /\.hazard-layer-meta/);
assert.match(embeddedHazardMapCss[0], /\.hazard-colorbar/);
assert.match(embeddedHazardMapCss[0], /\.hazard-layer-source/);
assert.doesNotMatch(embeddedHazardMapCss[0], /\.hazard-source-chip/);
assert.doesNotMatch(embeddedHazardMapCss[0], /\.hazard-swatch/);
assert.match(embeddedHazardMapCss[0], /\.processed-hazard-overlays/);
assert.match(embeddedHazardMapCss[0], /\.processed-hazard-layer/);
assert.match(embeddedHazardMapCss[0], /\.processed-hazard-layer-wind_pgw_etc_proxy[\s\S]*saturate\(1\.08\)/);
assert.match(embeddedHazardMapCss[0], /\.processed-hazard-layer-rain_pgw_etc_proxy[\s\S]*saturate\(1\.06\)/);
assert.doesNotMatch(embeddedHazardMapCss[0], /\.processed-hazard-layer-heat_gla_london_risk/);
assert.match(embeddedHazardMapCss[0], /\.map-utility-controls[\s\S]*bottom:\s*286px/);
assert.match(embeddedHazardMapCss[0], /\.map-control-button[\s\S]*width:\s*36px[\s\S]*height:\s*36px/);
assert.match(embeddedHazardMapCss[0], /\.map-control-button[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.96\)/);
assert.match(embeddedHazardMapCss[0], /\.map-control-target/);
assert.match(embeddedHazardMapCss[0], /\.legend-current-layer/);
assert.match(embeddedHazardMapCss[0], /\.hazard-attribution-line/);
assert.match(embeddedHazardMapCss[0], /grid-template-columns:\s*332px minmax\(0,\s*1fr\)/);
assert.match(embeddedHazardMapCss[0], /\.map-stage[\s\S]*align-self:\s*stretch[\s\S]*height:\s*auto/);
assert.doesNotMatch(embeddedHazardMapCss[0], /(^|\n)\s*height:\s*690px/m);
assert.match(embeddedHazardMapCss[0], /\.map-asset-marker[\s\S]*grid-template-columns:\s*28px auto/);
assert.match(embeddedHazardMapCss[0], /\.map-asset-marker strong[\s\S]*font-size:\s*14px/);
assert.match(embeddedHazardMapCss[0], /\.map-asset-marker small[\s\S]*font-size:\s*10px/);
assert.match(embeddedHazardMapCss[0], /\.ramp-flood_jrc_rp100_depth/);
assert.doesNotMatch(embeddedHazardMapCss[0], /\.embedded-hazard-panel/);

const hazardManifest = JSON.parse(readFileSync(new URL("./hazard-layers/manifest.json", import.meta.url), "utf8"));
const readyHazardLayers = hazardManifest.layers.filter((layer) => layer.status === "ready" && layer.files?.png);
assert.ok(readyHazardLayers.length >= 7, "Expected processed hazard manifest to expose at least 7 ready PNG layers.");
assert.ok(readyHazardLayers.every((layer) => !layer.files?.display_png), "Product map should use canonical processed PNG layers, not rejected display variants.");
for (const layerId of ["wind_pgw_etc_proxy", "rain_pgw_etc_proxy", "wildfire_effis_fwi"]) {
  const layer = readyHazardLayers.find((item) => item.id === layerId);
  assert.ok(layer?.files?.visual_png?.startsWith("hazard-layers/visual/"), `Expected ${layerId} to use a visual overlay PNG.`);
}
for (const hazardType of ["flood", "heat", "wildfire", "wind", "rainfall", "water_stress"]) {
  assert.ok(readyHazardLayers.some((layer) => layer.hazard_type === hazardType), `Expected ${hazardType} hazard layer.`);
}
assert.ok(readyHazardLayers.every((layer) => layer.source_attribution), "All ready hazard layers must keep source attribution.");

const sampleCase = {
  case_id: "TVDC01-2026-REVIEW",
  asset: {
    name: "Thames Valley DC-01",
    type: "Data centre",
    region: "Thames Valley, UK",
  },
  review: {
    type: "Portfolio physical-risk review",
    moment: "Ahead of insurance renewal and internal asset risk update",
    human_reviewer_required: true,
  },
  sources: [
    {
      id: "external_physical_risk_signal",
      name: "External Data Centre Physical Risk Signal",
      granularity: "market_or_regional",
      time_horizon: "mixed_current_and_future_stress",
      useful_for: ["review_trigger", "asset_class_context"],
      cannot_support: ["pricing_decision", "engineering_conclusion"],
      caveat: "Useful as context and trigger, not as final site-level evidence.",
    },
  ],
  workup: {
    must_show: [
      "source_suitability_matrix",
      "multi_hazard_interpretation",
      "what_cannot_be_concluded",
    ],
    recommended_next_action:
      "Request current site-level resilience evidence and refer to risk engineering if evidence remains incomplete.",
    boundary:
      "No validated site-level risk, underwriting, pricing, valuation, insurability, Tier / standards compliance, BI, MFL / PML, or engineering conclusion has been made.",
  },
};

const rows = buildSourceRows(sampleCase.sources);
assert.equal(rows.length, 1);
assert.equal(rows[0].scale, "market_or_regional");
assert.match(rows[0].limits, /pricing_decision/);

const sections = getMustShowSections(sampleCase);
assert.deepEqual(sections, [
  "Source suitability matrix",
  "Multi hazard interpretation",
  "What cannot be concluded",
]);

const decision = buildDecisionRecord(sampleCase, "request_site_evidence", {
  selectedSourceIds: ["external_physical_risk_signal"],
  activeScenario: "water",
});
assert.equal(decision.caseId, "TVDC01-2026-REVIEW");
assert.match(decision.nextAction, /Request current site-level resilience evidence/);
assert.match(decision.boundary, /No validated site-level risk/);
assert.match(decision.boundary, /underwriting, pricing/);
assert.equal(decision.selectedActionId, "request_site_evidence");
assert.equal(decision.status, "Human-reviewed action captured");
assert.equal(decision.activeScenario, "water");
assert.deepEqual(decision.selectedSourceIds, ["external_physical_risk_signal"]);
assert.match(decision.evidenceContext.workupSummary, /source suitability/);
assert.equal(decision.evidenceContext.sourceCaveats.length, 1);

const actions = buildReviewActions(sampleCase);
assert.equal(actions.length, 3);
assert.equal(actions[0].id, "request_site_evidence");
assert.equal(actions[0].isDefault, true);
assert.match(actions[1].description, /decision-grade engineering assessment/);

const engineeringDecision = buildDecisionRecord(sampleCase, "refer_risk_engineering");
assert.equal(engineeringDecision.selectedActionId, "refer_risk_engineering");
assert.match(engineeringDecision.nextAction, /Refer to risk engineering/);
assert.equal(engineeringDecision.auditTrail.length, 5);
assert.match(engineeringDecision.auditTrail[3], /refer_risk_engineering/);
assert.match(engineeringDecision.auditTrail[4], /Decision record/);

const workflowSteps = buildWorkflowSteps("record");
assert.deepEqual(
  workflowSteps.map((step) => step.label),
  ["Case signal", "Information check", "Review prep", "Review decision", "Decision record"],
);
assert.deepEqual(
  workflowSteps.map((step) => step.sidebarLabel),
  ["Case", "Evidence", "Specialist", "Review", "Record"],
);
assert.deepEqual(
  workflowSteps.map((step) => step.status),
  ["complete", "complete", "complete", "complete", "active"],
);

const runningWorkflowSteps = buildWorkflowSteps("workup", {
  workupRunning: true,
  workupRunStep: 2,
  workupRunEvent: "resilience-gaps",
  workupRunComplete: false,
});
assert.deepEqual(
  runningWorkflowSteps.map((step) => step.status),
  ["complete", "complete", "active", "pending", "pending"],
);
assert.equal(runningWorkflowSteps[2].displayStatus, "preparing 3 / 4");
assert.equal(runningWorkflowSteps[2].displayDetail, "Data-centre Resilience Agent");
assert.equal(runningWorkflowSteps[2].label, "Review prep");
assert.equal(runningWorkflowSteps[2].specialistProgress, 3);
assert.equal(runningWorkflowSteps[2].specialistTotal, 4);

const completedWorkflowSteps = buildWorkflowSteps("workup", {
  workupRunning: false,
  workupRunStep: 4,
  workupRunComplete: true,
});
assert.deepEqual(
  completedWorkflowSteps.map((step) => step.status),
  ["complete", "complete", "complete", "ready", "pending"],
);
assert.equal(completedWorkflowSteps[2].displayStatus, "complete");
assert.equal(completedWorkflowSteps[3].displayStatus, "ready");
assert.equal(completedWorkflowSteps[3].label, "Review decision");

const sourceToSpatialHandoff = buildSpecialistPipelineState({
  workupRunning: true,
  workupRunStep: 0,
  workupRunEvent: "handoff-source-spatial",
});
assert.equal(sourceToSpatialHandoff.phase, "handoff");
assert.equal(sourceToSpatialHandoff.fromArtifact, "Source Suitability Matrix");
assert.equal(sourceToSpatialHandoff.toAgent, "Spatial Context Agent");
assert.equal(sourceToSpatialHandoff.currentFocus, "Passing material to the next step...");

const resiliencePipelineState = buildSpecialistPipelineState({
  workupRunning: true,
  workupRunStep: 2,
  workupRunEvent: "resilience-gaps",
});
assert.equal(resiliencePipelineState.phase, "running");
assert.equal(resiliencePipelineState.currentAgent, "Data-centre Resilience Agent");
assert.equal(resiliencePipelineState.currentFocus, "Building resilience gap board...");

const spatialContextPipelineState = buildSpecialistPipelineState({
  workupRunning: true,
  workupRunStep: 1,
  workupRunEvent: "spatial-context",
});
assert.equal(spatialContextPipelineState.phase, "running");
assert.equal(spatialContextPipelineState.currentAgent, "Spatial Context Agent");
assert.equal(spatialContextPipelineState.currentFocus, "Linking nearby spatial context...");

const pipelineTiming = buildSpecialistPipelineTiming();
assert.ok(pipelineTiming.totalMs >= 12000);
assert.ok(pipelineTiming.handoffMs >= 500);
assert.ok(pipelineTiming.queueCadenceMs >= 300);
assert.ok(pipelineTiming.queueCadenceMs <= 350);
assert.ok(pipelineTiming.stages.dataCentreResilience.durationMs > pipelineTiming.stages.sourceSuitability.durationMs);

const waitingState = buildSpecialistWaitingState({
  workupRunning: true,
  workupRunStep: 2,
  workupRunEvent: "resilience-gaps",
});
assert.deepEqual(
  waitingState.map((item) => item.state),
  ["complete", "complete", "running", "queued"],
);
assert.equal(waitingState[2].label, "Data-centre Resilience");

const guide = buildOperatorGuide("workup");
assert.equal(guide.nextView, "workup");
assert.equal(guide.action, "run-workup");
assert.equal(guide.instruction, "Prepare the review package");

const idleWorkupGuide = buildOperatorGuide("workup", { runState: "queued" });
assert.equal(idleWorkupGuide.title, "Step 3");
assert.equal(idleWorkupGuide.instruction, "Prepare the review package");
assert.match(idleWorkupGuide.description, /Selected information is checked/);
assert.equal(idleWorkupGuide.nextLabel, "Prepare Review Package");

const runningWorkupGuide = buildOperatorGuide("workup", { runState: "running" });
assert.equal(runningWorkupGuide.instruction, "Preparing the review package");
assert.equal(runningWorkupGuide.nextLabel, "Preparing Review Package...");
assert.equal(runningWorkupGuide.disabled, true);

const completedWorkupGuide = buildOperatorGuide("workup", { runState: "completed" });
assert.equal(completedWorkupGuide.instruction, "Review package ready");
assert.equal(completedWorkupGuide.description, "Requests are ready for reviewer action.");
assert.equal(completedWorkupGuide.nextLabel, "Continue to Review");
assert.equal(completedWorkupGuide.nextView, "review");

const reviewGuide = buildOperatorGuide("review");
assert.equal(reviewGuide.instruction, "Review decision");
assert.equal(reviewGuide.description, "Review requests, resolve open questions, and choose what to record.");
assert.equal(reviewGuide.nextLabel, "Create decision record");

const recordGuide = buildOperatorGuide("record");
assert.equal(recordGuide.instruction, "Create decision record");
assert.equal(recordGuide.description, "Save the evidence trail, reviewer action, caveats, and outcome.");

const spatialWorkup = buildSpatialWorkup(sampleCase, ["external_physical_risk_signal"]);
assert.equal(spatialWorkup.assetGeometry.type, "synthetic point");
assert.equal(spatialWorkup.operations.length, 4);
assert.equal(spatialWorkup.sourceDiagnostics.length, 1);
assert.equal(spatialWorkup.sourceDiagnostics[0].spatialMethod, "scale caveat review");
assert.match(spatialWorkup.sourceDiagnostics[0].reviewUse, /trigger/);
assert.match(spatialWorkup.professionalBoundary, /not a GIS-certified site assessment/);

const professionalWorkup = buildProfessionalWorkupPayload(sampleCase, {
  selectedSourceIds: ["external_physical_risk_signal"],
  activeScenario: "water",
});
assert.equal(professionalWorkup.caseId, "TVDC01-2026-REVIEW");
assert.equal(professionalWorkup.activeScenario, "water");
assert.equal(professionalWorkup.selectedSourceCount, 1);
assert.equal(professionalWorkup.sourceSuitability.length, 1);
assert.equal(professionalWorkup.sourceSuitability[0].nativeScale, "market_or_regional");
assert.equal(professionalWorkup.spatialTemporalContext.sourceDiagnostics.length, 1);
assert.ok(professionalWorkup.resilienceEvidenceGaps.length >= 3);
assert.ok(professionalWorkup.hazardEvidenceInterpretation.length >= 4);
assert.ok(
  professionalWorkup.hazardEvidenceInterpretation.some(
    (row) => row.hazard === "Flood / surface water" && row.evidenceRequest.includes("drainage"),
  ),
);
assert.ok(professionalWorkup.reviewQuestions.some((question) => question.includes("site-level")));
assert.match(professionalWorkup.professionalBoundary, /No validated site-level risk/);

const hazardInterpretation = buildHazardEvidenceInterpretation();
assert.ok(hazardInterpretation.some((row) => row.hazard === "Power continuity"));
assert.ok(hazardInterpretation.every((row) => row.boundary.includes("review")));

const executionPlan = buildWorkupExecutionPlan(sampleCase, {
  selectedSourceIds: ["external_physical_risk_signal"],
  activeScenario: "water",
  createdTaskIds: ["site_asset_basis"],
});
assert.equal(executionPlan.status, "Reviewer action required");
assert.match(executionPlan.primaryNextStep, /Request current site-level resilience evidence/);
assert.equal(executionPlan.evidenceTasks.length, 6);
assert.equal(executionPlan.createdEvidenceRequestCount, 1);
assert.equal(executionPlan.evidenceTasks[0].status, "Request created");
assert.equal(executionPlan.evidenceTasks[1].status, "Needs request");
assert.ok(executionPlan.blockers.some((blocker) => blocker.title.includes("Site evidence")));
assert.ok(executionPlan.evidenceTasks.some((task) => task.owner === "Asset owner / broker"));
assert.ok(executionPlan.handoffActions.some((action) => action.id === "refer_risk_engineering"));
assert.ok(executionPlan.supportingDetails.some((detail) => detail.id === "source-caveats"));

const queueItem = buildQueueItem(sampleCase, ["external_physical_risk_signal"], "water");
assert.equal(queueItem.queueName, "DataCentrePhysicalRiskReview");
assert.equal(queueItem.reference, "TVDC01-2026-REVIEW");
assert.equal(queueItem.priority, "Normal");
assert.equal(queueItem.specificContent.queueReferenceId, "TVDC01-2026-REVIEW");
assert.equal(queueItem.specificContent.workflowState, "case_intake_created");
assert.equal(queueItem.specificContent.slaHours, 48);
assert.equal(queueItem.specificContent.retryLimit, 2);
assert.equal(queueItem.specificContent.caseId, "TVDC01-2026-REVIEW");
assert.equal(queueItem.specificContent.activeScenario, "water");
assert.equal(queueItem.specificContent.sourceCount, 1);
assert.equal(queueItem.specificContent.humanReviewRequired, true);
assert.deepEqual(queueItem.specificContent.selectedSourceIds, ["external_physical_risk_signal"]);

const humanTask = buildHumanReviewTask(sampleCase, {
  selectedSourceIds: ["external_physical_risk_signal"],
  activeScenario: "water",
  createdTaskIds: ["site_asset_basis"],
});
assert.equal(humanTask.taskTitle, "Review physical-risk work-up: Thames Valley DC-01");
assert.equal(humanTask.integrationMode, "human_task_model");
assert.equal(humanTask.assignedRole, "Portfolio risk reviewer");
assert.equal(humanTask.inputRecord.activeScenario, "water");
assert.equal(humanTask.inputRecord.selectedSourceIds.length, 1);
assert.equal(humanTask.inputRecord.workupSummary, professionalWorkup.summary);
assert.ok(humanTask.inputRecord.missingEvidence.length >= 3);
assert.equal(humanTask.inputRecord.createdEvidenceRequestCount, 1);
assert.deepEqual(humanTask.inputRecord.createdEvidenceRequestIds, ["site_asset_basis"]);
assert.equal(humanTask.suggestedEvidenceOwner, "Asset owner / broker / risk engineering");
assert.deepEqual(humanTask.outputFields, ["selectedActionId", "reviewerNote", "evidenceOwner"]);
assert.equal(humanTask.options.length, 3);

const workflowStages = buildWorkflowStages(sampleCase, {
  selectedSourceIds: ["external_physical_risk_signal"],
  activeScenario: "water",
});
assert.equal(workflowStages.length, 7);
assert.equal(workflowStages[0].id, "case_intake");
assert.deepEqual(workflowStages.map((stage) => stage.id), [
  "case_intake",
  "confirm_evidence_readiness",
  "run_specialist_workup",
  "create_review_task",
  "evidence_incomplete_retry_or_escalate",
  "capture_reviewer_action",
  "generate_decision_record",
]);
assert.match(workflowStages[2].output, /Review artifacts/);
assert.match(workflowStages[3].input, /Prepared review artifacts/);
assert.match(workflowStages[3].output, /Review task/);
assert.match(workflowStages[4].output, /Retry, wait, escalate/);

const workflowPayload = buildUiPathWorkflowPayload(sampleCase, {
  selectedSourceIds: ["external_physical_risk_signal"],
  activeScenario: "water",
  selectedActionId: "refer_risk_engineering",
  createdTaskIds: ["site_asset_basis"],
});
assert.equal(workflowPayload.workflowName, "Edgion_DataCentre_PhysicalRisk_Workup");
assert.deepEqual(workflowPayload.stages.map((stage) => stage.id), workflowStages.map((stage) => stage.id));
assert.equal(workflowPayload.queueItem.reference, "TVDC01-2026-REVIEW");
assert.equal(workflowPayload.professionalWorkup.selectedSourceCount, 1);
assert.equal(workflowPayload.professionalWorkup.sourceSuitability.length, 1);
assert.equal(workflowPayload.humanTask.inputRecord.activeScenario, "water");
assert.equal(workflowPayload.decisionRecord.selectedActionId, "refer_risk_engineering");
assert.equal(workflowPayload.decisionRecord.evidenceContext.selectedSourceCount, 1);
assert.equal(workflowPayload.decisionRecord.evidenceContext.createdEvidenceRequestCount, 1);
assert.deepEqual(workflowPayload.decisionRecord.evidenceContext.createdEvidenceRequestIds, ["site_asset_basis"]);
assert.equal(workflowPayload.auditOutput.recordType, "workflow_decision_packet");
assert.deepEqual(workflowPayload.outputArtifacts, [
  "queue_item_payload",
  "human_task_model",
  "decision_record_json",
  "audit_trail",
]);

const demoWorkflowPayload = buildUiPathWorkflowPayload(demoCaseData);
assert.equal(demoWorkflowPayload.professionalWorkup.selectedSourceCount, 5);
assert.equal(demoWorkflowPayload.professionalWorkup.sourceSuitability.length, 5);
assert.ok(demoWorkflowPayload.professionalWorkup.resilienceEvidenceGaps.length >= 5);
assert.ok(demoWorkflowPayload.professionalWorkup.hazardEvidenceInterpretation.length >= 5);
assert.equal(demoWorkflowPayload.executionPlan.status, "Reviewer action required");
assert.equal(demoWorkflowPayload.executionPlan.evidenceTasks.length, 6);
assert.ok(
  demoWorkflowPayload.professionalWorkup.sourceSuitability.some((source) =>
    source.cannotSupport.includes("underwriting_decision"),
  ),
);
assert.match(demoWorkflowPayload.humanTask.inputRecord.workupSummary, /5 selected sources/);

console.log("core prototype tests passed");
