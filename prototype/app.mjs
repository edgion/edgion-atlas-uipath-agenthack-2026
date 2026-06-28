import {
  buildOperatorGuide,
  buildReviewActions,
  buildSpecialistPipelineState,
  buildSpecialistPipelineTiming,
  buildSpecialistWaitingState,
  buildSourceRows,
  buildSpatialWorkup,
  buildUiPathWorkflowPayload,
  buildWorkflowSteps,
} from "./core.mjs";
import { caseData } from "./data.mjs";

const sourceRows = buildSourceRows(caseData.sources);
const reviewActions = buildReviewActions(caseData);
const defaultSourceIds = sourceRows.map((row) => row.id);
const pipelineTiming = buildSpecialistPipelineTiming();
const hazardAssetVersion = "processed-hazard-map-21";
const hazardInitialView = {
  center: [51.51, -0.2],
  zoom: 11,
};
const hazardDefaultVisible = new Set(["wind_pgw_etc_proxy"]);
const hazardLayerOpacity = {
  flood_jrc_rp100_depth: 0.48,
  flood_ea_zone3_extent: 0.34,
  heat_gla_london_risk: 0.42,
  wildfire_effis_fwi: 0.88,
  wind_pgw_etc_proxy: 0.92,
  rain_pgw_etc_proxy: 0.9,
  water_stress_wri_aqueduct: 0.72,
};
const hazardLayerControls = [
  {
    id: "flood_jrc_rp100_depth",
    label: "Flood: UK river RP100 depth",
    source: "JRC/CEMS",
    defaultChecked: false,
  },
  {
    id: "flood_ea_zone3_extent",
    label: "Flood: EA Zone 3 extent",
    source: "EA OGL",
    defaultChecked: false,
  },
  {
    id: "heat_gla_london_risk",
    label: "Heat: GLA heat risk",
    source: "GLA",
    defaultChecked: false,
  },
  {
    id: "wildfire_effis_fwi",
    label: "Wildfire danger: EFFIS FWI",
    source: "EFFIS",
    defaultChecked: false,
  },
  {
    id: "wind_pgw_etc_proxy",
    label: "Wind: storm footprint proxy",
    source: "Synthetic proxy",
    defaultChecked: true,
  },
  {
    id: "rain_pgw_etc_proxy",
    label: "Rain: rainfall footprint proxy",
    source: "Synthetic proxy",
    defaultChecked: false,
  },
  {
    id: "water_stress_wri_aqueduct",
    label: "Water stress: WRI Aqueduct",
    source: "WRI",
    defaultChecked: false,
  },
];

const appState = {
  view: "case",
  activeScenario: "multi-hazard",
  selectedSourceIds: new Set(defaultSourceIds),
  selectedActionId: "request_site_evidence",
  activeGeoSourceId: "screening_level_spatial_hazard_context",
  workupRunning: false,
  workupRunStep: -1,
  workupRunComplete: false,
  workupRunEvent: "idle",
  workupMicro: {
    sourceRows: 0,
    sourceLimits: false,
    sourceMatrixRows: 0,
    spatialZoom: false,
    spatialBuffer: false,
    spatialContext: false,
    spatialDetails: false,
    hazardThemes: 0,
    dependencies: 0,
    gapItems: 0,
    handoffVisible: 0,
    handoffReady: 0,
  },
  activityFeed: [],
  createdTaskIds: new Set(),
  recordGenerated: false,
  recordJsonOpen: false,
  bridge: {
    caseId: null,
    workflowRunId: null,
    status: "not_started",
    mode: "checking",
    configured: false,
    busy: false,
    lastError: "",
    finalPayload: null,
    history: [],
  },
};

let workupRunTimers = [];
let embeddedHazardMap = null;

const views = {
  case: renderCase,
  inputs: renderInputs,
  workup: renderWorkup,
  review: renderReview,
  record: renderRecord,
};

function buttonArrow() {
  return `
    <svg class="button-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function pills(items) {
  return `<div class="pill-row">${items.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}</div>`;
}

function selectedSourceRows() {
  return sourceRows.filter((row) => appState.selectedSourceIds.has(row.id));
}

function currentDecisionRecord() {
  return currentWorkflowPayload().decisionRecord;
}

function currentSpatialWorkup() {
  return buildSpatialWorkup(caseData, selectedSourceRows().map((row) => row.id));
}

function currentWorkflowPayload() {
  return buildUiPathWorkflowPayload(caseData, {
    selectedSourceIds: selectedSourceRows().map((row) => row.id),
    activeScenario: appState.activeScenario,
    selectedActionId: appState.selectedActionId,
    createdTaskIds: Array.from(appState.createdTaskIds),
  });
}

const workflowBridge = {
  apiBase: "",
  canCall() {
    return window.location.protocol === "http:" || window.location.protocol === "https:";
  },
};

function bridgeSnapshot() {
  return {
    caseId: appState.bridge.caseId,
    workflowRunId: appState.bridge.workflowRunId,
    status: appState.bridge.status,
    mode: appState.bridge.mode,
    configured: appState.bridge.configured,
    history: appState.bridge.history,
    lastError: appState.bridge.lastError,
  };
}

function resetWorkflowBridge(reason = "Case inputs changed") {
  appState.bridge = {
    ...appState.bridge,
    caseId: null,
    workflowRunId: null,
    status: "not_started",
    busy: false,
    lastError: "",
    finalPayload: null,
    history: reason ? [{ label: reason, detail: "Workflow will restart with the updated inputs." }] : [],
  };
}

function pushBridgeHistory(label, detail = "") {
  appState.bridge.history = [
    { label, detail },
    ...appState.bridge.history.filter((item) => item.label !== label),
  ].slice(0, 5);
}

function bridgeEventLabel(event) {
  const labels = {
    case_created: "Case accepted",
    workup_prepared: "Review package prepared",
    evidence_request_created: "Evidence request opened",
    human_action_captured: "Reviewer action captured",
    final_payload_generated: "Decision record generated",
  };
  return labels[event] ?? event;
}

function bridgeEventDetail(detail = {}) {
  if (typeof detail === "string") return detail;
  if (detail.selectedActionId) return detail.selectedActionId;
  if (detail.taskId) return detail.taskId;
  if (detail.evidenceTaskCount) return `${detail.evidenceTaskCount} requests ready`;
  if (detail.createdEvidenceRequestCount !== undefined) return `${detail.createdEvidenceRequestCount} request opened`;
  if (detail.selectedSourceCount) return `${detail.selectedSourceCount} sources processed`;
  return "";
}

function updateBridgeFromResponse(body) {
  if (!body) return;
  if (body.caseId) appState.bridge.caseId = body.caseId;
  if (body.workflowRunId) appState.bridge.workflowRunId = body.workflowRunId;
  if (body.status) appState.bridge.status = body.status;
  if (body.backendState?.status) appState.bridge.status = body.backendState.status;
  if (body.uipath?.mode) appState.bridge.mode = body.uipath.mode;
  if (typeof body.uipath?.configured === "boolean") appState.bridge.configured = body.uipath.configured;
  if (body.backendState?.history) {
    appState.bridge.history = body.backendState.history
      .slice()
      .reverse()
      .slice(0, 5)
      .map((entry) => ({ label: bridgeEventLabel(entry.event), detail: bridgeEventDetail(entry.detail) }));
  }
}

async function bridgeRequest(path, { method = "GET", body = null } = {}) {
  if (!workflowBridge.canCall()) throw new Error("Workflow bridge server is not available from a file URL.");
  const response = await fetch(`${workflowBridge.apiBase}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : null,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `Workflow bridge request failed: ${response.status}`);
  return payload;
}

function renderBridgeHost() {
  const host = document.querySelector("#workflow-bridge-host");
  if (host) host.innerHTML = renderWorkflowBridgeStatus();
}

async function ensureWorkflowCase() {
  if (appState.bridge.caseId) return appState.bridge.caseId;
  appState.bridge.busy = true;
  appState.bridge.lastError = "";
  renderBridgeHost();
  try {
    const created = await bridgeRequest("/api/workflow/cases", {
      method: "POST",
      body: {
        selectedSourceIds: selectedSourceRows().map((row) => row.id),
        activeScenario: appState.activeScenario,
      },
    });
    updateBridgeFromResponse(created);
    pushBridgeHistory("Case accepted", `${created.workflowRunId} · ${created.bridgeStage}`);
    return created.caseId;
  } catch (error) {
    appState.bridge.mode = "local-ui";
    appState.bridge.status = "local_only";
    appState.bridge.lastError = error.message;
    pushBridgeHistory("Local UI mode", "Run workflow_bridge_server.mjs to enable backend orchestration.");
    return null;
  } finally {
    appState.bridge.busy = false;
    renderBridgeHost();
  }
}

async function runBridgeWorkup() {
  const caseId = await ensureWorkflowCase();
  if (!caseId) return null;
  appState.bridge.busy = true;
  renderBridgeHost();
  try {
    const result = await bridgeRequest(`/api/workflow/cases/${encodeURIComponent(caseId)}/workup`, { method: "POST" });
    updateBridgeFromResponse(result);
    pushBridgeHistory("Review package prepared", `${result.professionalWorkup.selectedSourceCount} sources processed`);
    return result;
  } catch (error) {
    appState.bridge.lastError = error.message;
    pushBridgeHistory("Bridge work-up failed", error.message);
    return null;
  } finally {
    appState.bridge.busy = false;
    renderBridgeHost();
  }
}

async function createBridgeEvidenceRequest(taskId) {
  const caseId = await ensureWorkflowCase();
  if (!caseId) return null;
  appState.bridge.busy = true;
  renderBridgeHost();
  try {
    const result = await bridgeRequest(`/api/workflow/cases/${encodeURIComponent(caseId)}/evidence-requests`, {
      method: "POST",
      body: { taskId },
    });
    updateBridgeFromResponse(result);
    pushBridgeHistory("Evidence request opened", taskId);
    return result;
  } catch (error) {
    appState.bridge.lastError = error.message;
    pushBridgeHistory("Evidence request failed", error.message);
    return null;
  } finally {
    appState.bridge.busy = false;
    renderBridgeHost();
  }
}

async function captureBridgeHumanAction(selectedActionId) {
  const caseId = await ensureWorkflowCase();
  if (!caseId) return null;
  appState.bridge.busy = true;
  renderBridgeHost();
  try {
    const result = await bridgeRequest(`/api/workflow/cases/${encodeURIComponent(caseId)}/human-action`, {
      method: "POST",
      body: {
        selectedActionId,
        reviewerNote: "Reviewer selected action from the review workspace.",
        evidenceOwner: selectedActionId === "refer_risk_engineering" ? "Risk engineering" : "Asset owner / broker",
      },
    });
    updateBridgeFromResponse(result);
    pushBridgeHistory("Reviewer action captured", selectedActionId);
    return result;
  } catch (error) {
    appState.bridge.lastError = error.message;
    pushBridgeHistory("Reviewer action failed", error.message);
    return null;
  } finally {
    appState.bridge.busy = false;
    renderBridgeHost();
  }
}

async function refreshBridgeFinalPayload() {
  const caseId = await ensureWorkflowCase();
  if (!caseId) return null;
  try {
    const result = await bridgeRequest(`/api/workflow/cases/${encodeURIComponent(caseId)}/final-payload`);
    appState.bridge.finalPayload = result;
    updateBridgeFromResponse(result);
    pushBridgeHistory("Decision record generated", result.runtime.currentStage);
    renderBridgeHost();
    return result;
  } catch (error) {
    appState.bridge.lastError = error.message;
    pushBridgeHistory("Decision record sync failed", error.message);
    renderBridgeHost();
    return null;
  }
}

function createdEvidenceTasks(executionPlan) {
  return executionPlan.evidenceTasks.filter((task) => appState.createdTaskIds.has(task.id));
}

function latestCreatedEvidenceTask(executionPlan) {
  const latestId = Array.from(appState.createdTaskIds).at(-1);
  return executionPlan.evidenceTasks.find((task) => task.id === latestId) ?? null;
}

function resetWorkupMicroState() {
  appState.workupRunEvent = "idle";
  appState.workupMicro = {
    sourceRows: 0,
    sourceLimits: false,
    sourceMatrixRows: 0,
    spatialZoom: false,
    spatialBuffer: false,
    spatialContext: false,
    spatialDetails: false,
    hazardThemes: 0,
    dependencies: 0,
    gapItems: 0,
    handoffVisible: 0,
    handoffReady: 0,
  };
  appState.activityFeed = [];
}

function clearWorkupTimers() {
  workupRunTimers.forEach((timer) => clearTimeout(timer));
  workupRunTimers = [];
}

function pushActivity(message) {
  appState.activityFeed = [message, ...appState.activityFeed.filter((item) => item !== message)].slice(0, 5);
}

function workupRunState() {
  if (appState.workupRunComplete) return "completed";
  if (appState.workupRunning) return "running";
  return "queued";
}

function workupAgentState(index) {
  const pipeline = currentPipelineState();
  if (pipeline.phase === "handoff") {
    if (index <= pipeline.fromIndex) return "completed";
    return "queued";
  }
  if (appState.workupRunComplete || index < appState.workupRunStep) return "completed";
  if (appState.workupRunning && index === appState.workupRunStep) return "running";
  return "queued";
}

function runningAgentTitle(cards) {
  if (!appState.workupRunning) return "";
  const pipeline = currentPipelineState();
  if (pipeline.phase === "handoff") return pipeline.toAgent;
  const activeIndex = Math.max(0, Math.min(appState.workupRunStep, cards.length - 1));
  return cards[activeIndex]?.title ?? "";
}

function currentPipelineState() {
  return buildSpecialistPipelineState({
    workupRunning: appState.workupRunning,
    workupRunStep: appState.workupRunStep,
    workupRunEvent: appState.workupRunEvent,
    workupRunComplete: appState.workupRunComplete,
  });
}

function taskOrigin(task) {
  const origins = {
    site_asset_basis: "Source Suitability Agent",
    flood_surface_water_controls: "Data-centre Resilience Agent",
    power_continuity: "Data-centre Resilience Agent",
    cooling_continuity: "Data-centre Resilience Agent",
    water_dependency: "Data-centre Resilience Agent",
    risk_engineering_record: "Workflow Handoff Agent",
  };
  return origins[task.id] ?? "Workflow Handoff Agent";
}

function buildWorkupAgentCards(workup, executionPlan) {
  return [
    {
      icon: "SS",
      title: "Source Suitability Agent",
      purpose: "Evaluate how each source can support this review.",
      artifact: "Source Suitability Matrix",
      activity: `${workup.selectedSourceCount} selected sources checked for scale, horizon, limits, and caveats.`,
    },
    {
      icon: "SC",
      title: "Spatial Context Agent",
      purpose: "Record spatial and temporal context without making a site-level conclusion.",
      artifact: "Spatial Context Note",
      activity: `${workup.spatialTemporalContext.sourceDiagnostics.length} source diagnostics mapped to review geometry.`,
    },
    {
      icon: "DR",
      title: "Data-centre Resilience Agent",
      purpose: "Translate hazard context into data-centre evidence gaps.",
      artifact: "Resilience Gap Board",
      activity: `${workup.resilienceEvidenceGaps.length} resilience evidence gaps prepared for request generation.`,
    },
    {
      icon: "WH",
      title: "Workflow Handoff Agent",
      purpose: "Prepare the queue and handoff for human assessment.",
      artifact: "Evidence Request Queue",
      activity: `${executionPlan.evidenceTasks.length} evidence requests prepared; the reviewer owns the decision.`,
    },
  ];
}

function currentWorkflowStepState() {
  return {
    workupRunning: appState.workupRunning,
    workupRunStep: appState.workupRunStep,
    workupRunEvent: appState.workupRunEvent,
    workupRunComplete: appState.workupRunComplete,
  };
}

function sidebarIcon(id) {
  const icons = {
    case: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /></svg>`,
    inputs: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16" /><path d="M4 17h16" /><path d="M8 4v6" /><path d="M16 14v6" /></svg>`,
    workup: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M17 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M17 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M9.6 11.2 14.4 8.8" /><path d="M9.7 15.1 14.3 17.9" /></svg>`,
    review: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 19a6 6 0 0 0-12 0" /><circle cx="9" cy="7" r="4" /><path d="m16 11 2 2 4-5" /></svg>`,
    record: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h4" /><path d="m9.5 14 2 2 4-4" /></svg>`,
  };
  return icons[id] ?? icons.case;
}

function sidebarStatusGlyph(status) {
  if (status === "complete") return "✓";
  if (status === "active") return "→";
  if (status === "ready") return "•";
  return "";
}

function renderWorkflowSidebar(activeView) {
  const workflowSteps = buildWorkflowSteps(activeView, currentWorkflowStepState());
  return workflowSteps
    .map(
      (step) => `
            <button class="nav-button ${escapeHtml(step.status)}" type="button" data-view="${escapeHtml(step.id)}" data-workflow-status="${escapeHtml(step.status)}" aria-label="${escapeHtml(`${step.label}: ${step.displayStatus ?? step.status}`)}">
              ${sidebarIcon(step.id)}
              <span class="nav-label">${escapeHtml(step.sidebarLabel ?? step.label)}</span>
              <span class="nav-step-state" aria-hidden="true">${escapeHtml(sidebarStatusGlyph(step.status))}</span>
            </button>
      `,
    )
    .join("");
}

function renderWorkflowStrip(activeView) {
  return `
    <section class="workflow-strip" aria-label="Demo workflow">
      ${buildWorkflowSteps(activeView, currentWorkflowStepState())
        .map(
          (step, index) => `
            <button class="workflow-step ${step.status} ${step.id === "workup" && appState.workupRunning ? "is-live" : ""}" type="button" data-view="${escapeHtml(step.id)}" data-workflow-step="${escapeHtml(step.id)}">
              <span class="workflow-step-number">${String(index + 1).padStart(2, "0")}</span>
              <span class="workflow-step-copy">
                <span>${escapeHtml(step.label)}</span>
                <strong>${escapeHtml(step.displayStatus ?? step.status)}</strong>
                ${step.displayDetail ? `<small>${escapeHtml(step.displayDetail)}</small>` : ""}
                ${renderWorkflowSpecialistDots(step)}
              </span>
            </button>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderWorkflowSpecialistDots(step) {
  if (step.id !== "workup" || !appState.workupRunning) return "";
  const total = step.specialistTotal ?? 4;
  const progress = step.specialistProgress ?? 1;
  return `
    <span class="workflow-specialist-dots" aria-label="${escapeHtml(`Specialist progress ${progress} of ${total}`)}">
      ${Array.from({ length: total }, (_, index) => `<i class="${index < progress ? "filled" : ""}"></i>`).join("")}
    </span>
  `;
}

function renderWorkflowBridgeStatus() {
  const bridge = appState.bridge;
  const runLabel = bridge.workflowRunId ? `Run ${bridge.workflowRunId}` : "Ready to start";
  const modeLabel =
    bridge.mode === "uipath"
      ? "UiPath Cloud configured"
      : bridge.mode === "local-ui"
        ? "Local UI fallback"
        : bridge.mode === "local"
          ? "Local bridge"
          : "Bridge ready";
  const trail = bridge.history.length
    ? bridge.history
    : [{ label: "Workflow trail", detail: "Actions will appear here when the case starts." }];
  return `
    <section class="workflow-bridge-status ${bridge.busy ? "busy" : ""}" aria-label="Orchestrated workflow" data-workflow-run-id="${escapeHtml(bridge.workflowRunId ?? "")}">
      <div class="workflow-bridge-primary">
        <p class="eyebrow">Orchestrated workflow</p>
        <strong>${escapeHtml(runLabel)}</strong>
        <span>${escapeHtml(modeLabel)} · ${escapeHtml(bridge.status.replaceAll("_", " "))}</span>
      </div>
      <div class="workflow-bridge-trail">
        <span>Workflow trail</span>
        ${trail
          .map(
            (item) => `
              <p>
                <strong>${escapeHtml(item.label)}</strong>
                ${item.detail ? `<em>${escapeHtml(typeof item.detail === "string" ? item.detail : JSON.stringify(item.detail))}</em>` : ""}
              </p>
            `,
          )
          .join("")}
      </div>
      ${bridge.lastError ? `<small>${escapeHtml(bridge.lastError)}</small>` : ""}
    </section>
  `;
}

function renderStepHero(activeView, { runState = activeView === "workup" ? workupRunState() : "queued" } = {}) {
  const guide = buildOperatorGuide(activeView, { runState });
  const actionAttribute = guide.action === "run-workup" ? "data-run-workup" : `data-guide-next="${escapeHtml(guide.nextView)}"`;
  const button =
    guide.action === "none"
      ? ""
      : `<button class="step-hero-action" type="button" ${actionAttribute} ${guide.disabled ? "disabled" : ""}><span>${escapeHtml(guide.nextLabel)}</span>${buttonArrow()}</button>`;
  return `
    <section class="step-hero operator-guide" data-active-view="${escapeHtml(activeView)}">
      <div class="step-hero-content">
        <span class="step-hero-label">${escapeHtml(guide.title)}</span>
        <strong class="step-hero-title">${escapeHtml(guide.instruction)}</strong>
        ${guide.description ? `<p class="step-hero-description">${escapeHtml(guide.description)}</p>` : ""}
      </div>
      ${button}
    </section>
  `;
}

function scenarioLabel() {
  const labels = {
    "multi-hazard": "Reviewer action required",
    heat: "Heat stress evidence check",
    water: "Water dependency evidence check",
    storm: "Wind / storm evidence check",
  };
  return labels[appState.activeScenario] ?? labels["multi-hazard"];
}

function hazardAssetPath(path) {
  return `./${String(path).replace(/^public\//, "")}?v=${hazardAssetVersion}`;
}

function hazardSourceShort(layer) {
  if (layer.id?.includes("jrc")) return "JRC/CEMS";
  if (layer.id?.includes("gla")) return "GLA";
  if (layer.id?.includes("ea_zone")) return "EA OGL";
  if (layer.id?.includes("effis")) return "EFFIS";
  if (layer.id?.includes("pgw")) return "Synthetic proxy";
  if (layer.id?.includes("wri")) return "WRI";
  return "Source";
}

function hazardDisplayName(layer) {
  if (!layer) return "Visible hazard data";
  if (layer.id === "wind_pgw_etc_proxy") return "Wind: storm footprint proxy";
  if (layer.id === "rain_pgw_etc_proxy") return "Rain: rainfall footprint proxy";
  return layer.display_name ?? "Visible hazard data";
}

function hazardSourceDisclosure(layer) {
  if (!layer) return "Source: no hazard layer selected";
  if (layer.id === "flood_jrc_rp100_depth") {
    return "Source: JRC/CEMS Global River Flood Hazard Maps · screening layer · not site-level evidence";
  }
  if (layer.id === "flood_ea_zone3_extent") {
    return "Source: Environment Agency Flood Zone 3 extent · screening layer · not site-level evidence";
  }
  if (layer.id === "heat_gla_london_risk") {
    return "Source: GLA heat risk mapping · screening layer · not site-level evidence";
  }
  if (layer.id === "wildfire_effis_fwi") {
    return "Source: EFFIS fire weather index · screening layer · not site-level evidence";
  }
  if (layer.id === "wind_pgw_etc_proxy" || layer.id === "rain_pgw_etc_proxy") {
    return "Source: Synthetic proxy · screening layer · not site-level evidence";
  }
  if (layer.id === "water_stress_wri_aqueduct") {
    return "Source: WRI Aqueduct · screening layer · not site-level evidence";
  }
  return "Source: screening layer · not site-level evidence";
}

function hazardLegendText(layer) {
  const bins = layer.legend_bins || {};
  if (typeof bins === "string") return bins;
  return Object.entries(bins)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

function renderLayerPanel() {
  return `
    <aside class="layer-panel" aria-label="Map layer controls">
      <label class="layer-search">
        <span>⌕</span>
        <input value="Thames Valley DC-01" aria-label="Search layers and assets" />
      </label>
      <div class="layer-group">
        <p class="layer-heading">Physical-risk layers</p>
        ${hazardLayerControls
          .map(
            (layer) => `
              <label class="layer hazard-layer-toggle ${layer.defaultChecked ? "active" : ""}">
                <input type="checkbox" ${layer.defaultChecked ? "checked" : ""} data-hazard-layer-toggle="${escapeHtml(layer.id)}" />
                <span class="hazard-layer-content">
                  <span class="hazard-layer-title">${escapeHtml(layer.label)}</span>
                  <span class="hazard-layer-meta">
                    <span class="hazard-colorbar ramp-${escapeHtml(layer.id)}"></span>
                    <span class="hazard-layer-source">${escapeHtml(layer.source)}</span>
                  </span>
                </span>
              </label>
            `,
          )
          .join("")}
      </div>
      <div class="layer-group">
        <p class="layer-heading">Evidence overlays</p>
        <label class="layer evidence-layer-toggle active"><input type="checkbox" checked data-evidence-overlay-toggle="site_evidence_gaps" /> Site evidence gaps</label>
        <label class="layer evidence-layer-toggle active"><input type="checkbox" checked data-evidence-overlay-toggle="power_cooling_dependencies" /> Power / cooling dependencies</label>
        <label class="layer evidence-layer-toggle"><input type="checkbox" data-evidence-overlay-toggle="bi_sla_exposure" /> BI / SLA exposure</label>
      </div>
    </aside>
  `;
}

function renderProcessedMapStage() {
  return `
    <div class="map-stage" role="region" aria-label="Processed hazard-layer map">
      <div class="processed-hazard-overlays" data-hazard-map data-hazard-overlay-stack>
        <div class="embedded-hazard-map" data-hazard-leaflet aria-label="Processed hazard layer map canvas"></div>
        <div class="hazard-map-loading">
          <p class="eyebrow">Hazard overlays</p>
          <strong>Loading processed hazard layers...</strong>
        </div>
      </div>
      <div class="map-utility-controls" aria-label="Map controls">
        <button class="map-control-button" type="button" data-hazard-map-control="reset" aria-label="Reset map view"><span class="map-control-target" aria-hidden="true"></span></button>
        <button class="map-control-button map-control-zoom" type="button" data-hazard-map-control="zoom-in" aria-label="Zoom in">+</button>
        <button class="map-control-button map-control-zoom" type="button" data-hazard-map-control="zoom-out" aria-label="Zoom out">−</button>
      </div>
      <div class="map-asset-marker">
        <span></span>
        <div>
          <strong>Thames Valley DC-01</strong>
          <small>screening asset point · portfolio review</small>
        </div>
      </div>
      <div class="map-badge">SCREENING-LEVEL SPATIAL CONTEXT</div>
      <div class="risk-card">
        <p>WORK-UP STATUS</p>
        <strong>${escapeHtml(scenarioLabel())}</strong>
        <span>${escapeHtml(selectedSourceRows().length)} sources selected · site-level resilience evidence incomplete</span>
      </div>
      <div class="legend">
        <div class="legend-title">Hazard context · source native scale</div>
        <div class="legend-current-layer" data-hazard-current-layer>Wind: storm footprint proxy</div>
        <div class="legend-bar"><span></span><span></span><span></span><span></span><span></span></div>
        <div class="legend-labels"><span>screening</span><span>review trigger</span><span>evidence gap</span></div>
        <div class="legend-source" data-hazard-current-source>Synthetic proxy</div>
        <p class="hazard-source-note" data-hazard-source-note>Source: Synthetic proxy · screening layer · not site-level evidence</p>
        <p class="hazard-attribution-line" data-hazard-attribution></p>
      </div>
    </div>
  `;
}

function renderReviewHazardMapContext() {
  return `
    <section class="review-mini-map-context" aria-label="Review map context">
      <div class="review-mini-map-frame">
        <div class="processed-hazard-overlays" data-hazard-map data-hazard-overlay-stack>
          <div class="embedded-hazard-map" data-hazard-leaflet aria-label="Review context hazard map"></div>
          <div class="hazard-map-loading">
            <p class="eyebrow">Hazard overlays</p>
            <strong>Loading screening context...</strong>
          </div>
        </div>
        <div class="map-asset-marker">
          <span></span>
          <div>
            <strong>Thames Valley DC-01</strong>
            <small>screening asset point</small>
          </div>
        </div>
        <div class="map-badge">SCREENING-LEVEL SPATIAL CONTEXT</div>
        <div class="map-utility-controls" aria-label="Map controls">
          <button class="map-control-button" type="button" data-hazard-map-control="reset" aria-label="Reset map view"><span class="map-control-target" aria-hidden="true"></span></button>
          <button class="map-control-button map-control-zoom" type="button" data-hazard-map-control="zoom-in" aria-label="Zoom in">+</button>
          <button class="map-control-button map-control-zoom" type="button" data-hazard-map-control="zoom-out" aria-label="Zoom out">−</button>
        </div>
      </div>
      <div class="review-mini-map-copy">
        <p class="eyebrow">Map context</p>
        <h3>${escapeHtml(caseData.asset.name)}</h3>
        <dl>
          <div><dt>Scenario</dt><dd>${escapeHtml(scenarioLabel())}</dd></div>
          <div><dt>Layer</dt><dd data-hazard-current-layer>Wind: storm footprint proxy</dd></div>
          <div><dt>Sources</dt><dd>${escapeHtml(selectedSourceRows().length)} selected</dd></div>
          <div><dt>Current gap</dt><dd>Site-level resilience evidence incomplete</dd></div>
        </dl>
        <p class="review-mini-source" data-hazard-source-note>Source: Synthetic proxy · screening layer · not site-level evidence</p>
      </div>
    </section>
  `;
}

function renderMiniMapContext() {
  return `
    <section class="map-context">
      <div class="mini-map" role="img" aria-label="Compact spatial context map">
        <svg viewBox="0 0 460 220" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <filter id="mini-soften"><feGaussianBlur stdDeviation="14" /></filter>
            <linearGradient id="miniWaterGrad" x1="0" x2="1">
              <stop offset="0%" stop-color="#e2f0f5" />
              <stop offset="100%" stop-color="#f4f8f4" />
            </linearGradient>
          </defs>
          <rect width="460" height="220" fill="url(#miniWaterGrad)" />
          <path d="M0 174 C68 150 128 166 194 136 C252 108 292 122 354 84 C404 54 430 58 460 40 L460 220 L0 220 Z" fill="#f8faf7" stroke="#c9d6d2" />
          <path d="M0 174 C68 150 128 166 194 136 C252 108 292 122 354 84 C404 54 430 58 460 40" fill="none" stroke="#4fb1c7" stroke-width="2" opacity=".66" />
          <g filter="url(#mini-soften)" opacity=".78">
            <ellipse cx="176" cy="122" rx="96" ry="42" fill="#4bb7e8" />
            <ellipse cx="266" cy="86" rx="66" ry="28" fill="#2a7ed5" opacity=".58" />
            <ellipse cx="322" cy="148" rx="86" ry="34" fill="#f1a22f" opacity=".62" />
            <ellipse cx="376" cy="88" rx="58" ry="24" fill="#d94f39" opacity=".34" />
          </g>
          <g opacity=".22">
            <path d="M0 55 H460 M0 110 H460 M0 165 H460" stroke="#aebfba" />
            <path d="M92 0 V220 M184 0 V220 M276 0 V220 M368 0 V220" stroke="#aebfba" />
          </g>
          <circle cx="252" cy="128" r="8" fill="#ffb84e" stroke="#17231f" stroke-width="3" />
          <circle cx="252" cy="128" r="20" fill="none" stroke="#ffb84e" stroke-width="2" opacity=".5" />
        </svg>
      </div>
      <div class="map-context-copy">
        <p class="eyebrow">Map context</p>
        <h3>${escapeHtml(caseData.asset.name)}</h3>
        <dl>
          <div><dt>Scenario</dt><dd>${escapeHtml(scenarioLabel())}</dd></div>
          <div><dt>Sources</dt><dd>${escapeHtml(selectedSourceRows().length)} selected</dd></div>
          <div><dt>Location confidence</dt><dd>Demo point; review geometry only</dd></div>
          <div><dt>Current gap</dt><dd>Site-level resilience evidence incomplete</dd></div>
        </dl>
      </div>
    </section>
  `;
}

function renderCase() {
  const scenario = appState.activeScenario;
  return `
    <section class="atlas">
      <div class="atlas-toolbar">
        <div class="atlas-title">
          <span class="live-dot"></span>
          <strong>ATLAS · DATA CENTRE REVIEW</strong>
        </div>
        <div class="atlas-tools" aria-label="Map tools">
          <button class="atlas-tool active" type="button"><span aria-hidden="true">☰</span>Layers</button>
          <button class="atlas-tool" type="button"><span aria-hidden="true">⇄</span>Compare</button>
          <button class="atlas-tool" type="button"><span aria-hidden="true">⌁</span>Draw</button>
          <button class="atlas-tool" type="button"><span aria-hidden="true">⌖</span>Measure</button>
          <button class="atlas-tool" type="button"><span aria-hidden="true">⇩</span>Export</button>
          <button class="atlas-tool" type="button"><span aria-hidden="true">⚙</span>Settings</button>
        </div>
        <div class="event-tabs" aria-label="Hazard scenarios">
          <button class="event-tab ${scenario === "multi-hazard" ? "active" : ""}" type="button" data-scenario="multi-hazard">MULTI-HAZARD</button>
          <button class="event-tab ${scenario === "heat" ? "active" : ""}" type="button" data-scenario="heat">HEAT</button>
          <button class="event-tab ${scenario === "water" ? "active" : ""}" type="button" data-scenario="water">WATER</button>
          <button class="event-tab ${scenario === "storm" ? "active" : ""}" type="button" data-scenario="storm">STORM</button>
        </div>
      </div>
      <div class="atlas-body">
        ${renderLayerPanel()}
        ${renderProcessedMapStage()}
        <aside class="workup-summary">
          <p class="eyebrow">Review prep</p>
          <h3>Why this cannot close automatically</h3>
          <ul>
            <li>External signal is market / regional, not site evidence.</li>
            <li>Spatial layer is screening-level and needs location confidence.</li>
            <li>Power, cooling, water, and BI evidence are incomplete.</li>
            <li>No engineering or underwriting conclusion is made.</li>
          </ul>
          <button class="primary-action" type="button" data-view="workup"><span>Prepare review package</span>${buttonArrow()}</button>
        </aside>
      </div>
      <div class="atlas-footer" aria-label="Interface context">
        <div><span>Design language</span><strong>Edgion Next</strong></div>
        <div><span>Visual mode</span><strong>Spatial intelligence</strong></div>
        <div><span>Data freshness</span><strong>Live · 12m ago</strong></div>
        <div><span>Confidence mode</span><strong>Screening</strong></div>
      </div>
    </section>
  `;
}

async function initEmbeddedHazardMap() {
  const root = document.querySelector("[data-hazard-map]");
  if (!root) return;

  if (embeddedHazardMap) {
    embeddedHazardMap.remove();
    embeddedHazardMap = null;
  }

  if (!window.L) {
    root.querySelector("[data-hazard-leaflet]").insertAdjacentHTML("beforeend", `
      <div class="hazard-map-error">
        <strong>Map library unavailable</strong>
        <span>Processed hazard layers could not be initialized.</span>
      </div>
    `);
    return;
  }

  const response = await fetch("./hazard-layers/manifest.json");
  if (!response.ok) throw new Error(`Unable to load hazard-layers/manifest.json (${response.status})`);
  const manifest = await response.json();
  const layers = manifest.layers.filter((layer) => layer.status === "ready" && layer.files?.png);
  const visible = new Set(
    layers
      .filter((layer) => hazardDefaultVisible.has(layer.id))
      .map((layer) => layer.id),
  );

  if (!root.isConnected || document.querySelector("[data-hazard-map]") !== root) return;

  const mapElement = root.querySelector("[data-hazard-leaflet]");
  root.querySelector(".hazard-map-loading")?.remove();
  embeddedHazardMap = window.L.map(mapElement, {
    attributionControl: false,
    preferCanvas: true,
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    tap: false,
  }).setView(hazardInitialView.center, hazardInitialView.zoom);

  window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
  }).addTo(embeddedHazardMap);

  const overlayById = new Map();
  layers.forEach((layer, index) => {
    const pane = `embedded-hazard-pane-${index}`;
    embeddedHazardMap.createPane(pane);
    embeddedHazardMap.getPane(pane).style.zIndex = String(420 + index * 10);
    const overlay = window.L.imageOverlay(
      hazardAssetPath(layer.files.visual_png ?? layer.files.png),
      [[manifest.demo_bbox.south, manifest.demo_bbox.west], [manifest.demo_bbox.north, manifest.demo_bbox.east]],
      {
        opacity: hazardLayerOpacity[layer.id] ?? 0.62,
        pane,
        attribution: layer.source_attribution || layer.source || "",
        className: `processed-hazard-layer processed-hazard-layer-${layer.id}`,
      },
    );
    overlayById.set(layer.id, overlay);
  });

  const attribution = document.querySelector("[data-hazard-attribution]");
  const currentLayerLabel = document.querySelector("[data-hazard-current-layer]");
  const currentLayerSource = document.querySelector("[data-hazard-current-source]");
  const currentLayerSourceNote = document.querySelector("[data-hazard-source-note]");

  function hazardControlInputs() {
    return Array.from(document.querySelectorAll("[data-hazard-layer-toggle]"));
  }

  function activeLayerIdsFromControls() {
    const controls = hazardControlInputs();
    if (!controls.length) return Array.from(visible);
    return controls
      .filter((input) => input.checked)
      .flatMap((input) => input.dataset.hazardLayerToggle.split(/\s+/).filter(Boolean));
  }

  function renderAttribution() {
    const activeLayerIds = activeLayerIdsFromControls();
    const activeLayers = layers.filter((layer) => activeLayerIds.includes(layer.id));
    const primaryLayer = activeLayers[0];
    if (currentLayerLabel) currentLayerLabel.textContent = hazardDisplayName(primaryLayer);
    if (currentLayerSource) currentLayerSource.textContent = primaryLayer ? hazardSourceShort(primaryLayer) : "No layer selected";
    if (currentLayerSourceNote) currentLayerSourceNote.textContent = hazardSourceDisclosure(primaryLayer);
    if (attribution) attribution.textContent = activeLayers.length > 1 ? `${activeLayers.length} screening layers visible · not site-level evidence` : "";
  }

  function syncHazardLayers() {
    const controls = hazardControlInputs();
    if (controls.length) {
      visible.clear();
      controls.forEach((input) => {
        input.dataset.hazardLayerToggle.split(/\s+/).filter(Boolean).forEach((layerId) => {
          if (input.checked) visible.add(layerId);
        });
        input.closest(".layer")?.classList.toggle("active", input.checked);
      });
    }
    layers.forEach((layer) => {
      const overlay = overlayById.get(layer.id);
      if (visible.has(layer.id)) {
        if (!embeddedHazardMap.hasLayer(overlay)) overlay.addTo(embeddedHazardMap);
      } else if (embeddedHazardMap.hasLayer(overlay)) {
        embeddedHazardMap.removeLayer(overlay);
      }
    });
    renderAttribution();
  }

  hazardControlInputs().forEach((input) => {
    input.addEventListener("change", syncHazardLayers);
  });
  document.querySelectorAll("[data-evidence-overlay-toggle]").forEach((input) => {
    input.addEventListener("change", () => {
      input.closest(".layer")?.classList.toggle("active", input.checked);
    });
  });

  syncHazardLayers();
  window.setTimeout(() => embeddedHazardMap?.invalidateSize(), 80);
}

function renderInputs() {
  const selectedCount = selectedSourceRows().length;
  return `
    ${renderInputsReadiness(selectedCount)}
    ${renderEvidencePackageFlow(selectedCount)}
    ${renderInputsRecommendation(selectedCount)}
    ${renderEvidencePackageSupport()}
  `;
}

function renderInputsReadiness(selectedCount) {
  const isReady = selectedCount > 0;
  return `
    <section class="evidence-readiness ${isReady ? "ready" : "blocked"}" aria-label="Ready to continue">
      <div>
        <p class="eyebrow">Ready to Continue</p>
        <h2>${isReady ? "Ready to continue" : "Not ready to continue"}</h2>
        <h3>${isReady ? "Ready" : "Needs evidence"}</h3>
        <ul>
          <li>${selectedCount} sources checked</li>
          <li>${isReady ? "Ready for review preparation" : "Select information before continuing"}</li>
          <li>${isReady ? "Confirmation recorded" : "Confirmation pending"}</li>
        </ul>
      </div>
      <strong>${isReady ? "Ready to continue" : "Select sources"}</strong>
    </section>
  `;
}

function renderEvidencePackageFlow(selectedCount) {
  const steps = [
    {
      label: "Selected information",
      detail: `${selectedCount} / ${sourceRows.length} sources confirmed`,
    },
    {
      label: "Checked",
      detail: "Scale, use, limits, and caveats recorded",
    },
    {
      label: "Ready",
      detail: "Package confirmed",
    },
    {
      label: "Prepare review package",
      detail: "Ready for the next step",
    },
  ];
  return `
    <section class="evidence-package-flow" aria-label="Information check flow">
      ${steps
        .map(
          (step, index) => `
            <article class="flow-step ${index === steps.length - 1 ? "next" : "complete"}">
              <span>${String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>${escapeHtml(step.label)}</h3>
                <p>${escapeHtml(step.detail)}</p>
              </div>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function renderInputsRecommendation(selectedCount) {
  return `
    <section class="evidence-recommendation" aria-label="Review preparation decision">
      <div>
        <span aria-hidden="true">✓</span>
        <div>
          <p class="eyebrow">Next step</p>
          <h3>Prepare review package</h3>
          <ul>
            <li>Selected information checked</li>
            <li>Review requirements met</li>
            <li>Confirmation recorded</li>
          </ul>
          <p>The selected material is ready for the review package.</p>
        </div>
      </div>
      <div class="evidence-decision-action">
        <strong>${selectedCount} sources ready</strong>
        <button type="button" data-guide-next="workup"><span>Prepare Review Package</span>${buttonArrow()}</button>
      </div>
    </section>
  `;
}

function renderEvidencePackageSupport() {
  return `
    <section class="evidence-package-support" aria-label="Selected information">
      <div class="section-heading">
        <p class="eyebrow">Supporting information</p>
        <h2>Selected Information</h2>
        <p>Source details remain available if the reviewer needs to check them.</p>
      </div>
      <div class="source-list supporting">
        ${sourceRows.map((row) => renderSourceCard(row)).join("")}
      </div>
    </section>
  `;
}

function renderSourceCard(row) {
  const selected = appState.selectedSourceIds.has(row.id);
  return `
    <article class="source-card ${selected ? "selected" : ""}">
      <div class="source-card-primary">
        <div>
          <p class="eyebrow">${escapeHtml(row.type)}</p>
          <h3>${escapeHtml(row.name)}</h3>
          <p><strong>Purpose</strong> ${escapeHtml(row.usefulFor)}</p>
        </div>
        <label class="source-toggle">
          <input type="checkbox" data-source-id="${escapeHtml(row.id)}" ${selected ? "checked" : ""} />
          Include in review
        </label>
      </div>
      <details>
        <summary>Source details</summary>
        <dl>
          <div><dt>Scale</dt><dd>${escapeHtml(row.scale)}</dd></div>
          <div><dt>Time horizon</dt><dd>${escapeHtml(row.horizon)}</dd></div>
          <div><dt>Decision limits</dt><dd>${escapeHtml(row.limits)}</dd></div>
          <div><dt>Caveats</dt><dd>${escapeHtml(row.caveat)}</dd></div>
        </dl>
      </details>
    </article>
  `;
}

function renderWorkup() {
  const spatialWorkup = currentSpatialWorkup();
  const workflowPayload = currentWorkflowPayload();
  const workup = workflowPayload.professionalWorkup;
  const executionPlan = workflowPayload.executionPlan;
  const cards = buildWorkupAgentCards(workup, executionPlan);
  const runState = workupRunState();
  const runningAgent = runningAgentTitle(cards);
  return `
    <section class="agent-workup-shell" data-run-state="${escapeHtml(runState)}">
      ${renderStepHero("workup", { runState })}

      <div class="agent-workup-body">
        <section class="specialist-workup-panel" aria-label="Review preparation">
          <div class="workup-section-heading">
            <div>
              <p class="eyebrow">Review prep</p>
              <h3>Review preparation</h3>
              <p>Prepare the review package</p>
            </div>
            <span>${runState === "completed" ? "Ready" : runState === "running" ? "Running" : "Queued"}</span>
          </div>
          <div class="specialist-agent-stack">
            ${renderSpecialistAgentCards(cards)}
          </div>
        </section>

        ${renderEvidenceRequestQueue(executionPlan)}
      </div>

      ${renderPreparationDetails(workup, spatialWorkup, executionPlan)}
    </section>
  `;
}

function renderWorkupActionPanel(runState, runningAgent) {
  const isRunning = runState === "running";
  const isComplete = runState === "completed";
  const buttonLabel = isRunning
    ? "Preparing Review Package..."
    : isComplete
      ? "Review Package Ready"
      : "Prepare Review Package";
  return `
    <section class="workup-primary-panel ${escapeHtml(runState)}">
      <div>
        <p class="eyebrow">Review prep</p>
        <h3>${isComplete ? "Review package ready" : isRunning ? "Preparing the review package" : "Prepare the review package"}</h3>
        <p>${isComplete ? "Requests are now available in the queue. The reviewer owns the decision." : isRunning ? `${escapeHtml(runningAgent)} is active. The queue stays locked until handoff begins.` : "Four review checks are queued."}</p>
        <small>The reviewer owns the final action.</small>
      </div>
      <div class="workup-primary-actions">
        ${
          isComplete
            ? `
              <button class="workup-run-button" type="button" disabled>
                <span>${escapeHtml(buttonLabel)}</span>${buttonArrow()}
              </button>
            `
            : `
              <button class="workup-run-button" type="button" ${isRunning ? "disabled" : "data-run-workup"}>
                <span>${escapeHtml(buttonLabel)}</span>${buttonArrow()}
              </button>
            `
        }
        ${isComplete ? `<button class="workup-ghost-button" type="button" data-view="review">Continue to Review</button>` : ""}
      </div>
    </section>
  `;
}

function renderSpecialistAgentCards(cards) {
  return `
    ${cards
      .map((card, index) => {
      const state = workupAgentState(index);
      const statusLabel = state === "completed" ? "Completed" : state === "running" ? "Running" : "Queued";
      const progress = state === "completed" ? "100%" : state === "running" ? runningProgressForAgent(index) : "0%";
      return `
        <div class="specialist-pipeline-node">
          <article class="specialist-agent-card ${escapeHtml(state)}">
            <div class="agent-icon" aria-hidden="true">${escapeHtml(card.icon)}</div>
            <div class="agent-card-main">
              <div class="agent-card-title-row">
                <div>
                  <h4>${escapeHtml(card.title)}</h4>
                  <p>${escapeHtml(card.purpose)}</p>
                </div>
                <span class="agent-status ${escapeHtml(state)}">${escapeHtml(statusLabel)}</span>
              </div>
              <div class="agent-card-meta">
                <span>Artifact</span>
                <strong>${escapeHtml(card.artifact)}</strong>
                ${state === "completed" ? `<em>Prepared</em>` : ""}
              </div>
              ${renderAgentActivityDetail(index, state, card)}
              <div class="agent-progress" aria-label="${escapeHtml(statusLabel)} progress">
                <span style="width: ${progress}"></span>
              </div>
            </div>
          </article>
          ${renderPipelineBaton(index, cards)}
        </div>
      `;
      })
      .join("")}
    ${renderActivityFeed()}
  `;
}

function renderPipelineBaton(index, cards) {
  if (index >= cards.length - 1) return "";
  const pipeline = currentPipelineState();
  const isActive = pipeline.phase === "handoff" && pipeline.fromIndex === index;
  const isPrepared = appState.workupRunComplete || index < appState.workupRunStep || (pipeline.phase === "handoff" && index <= pipeline.fromIndex);
  return `
    <div class="pipeline-baton ${isActive ? "active" : isPrepared ? "prepared" : ""}">
      <span>${escapeHtml(cards[index].artifact)}</span>
      <i></i>
      <strong>${escapeHtml(cards[index + 1].title)}</strong>
      ${isActive ? `<em>Passing ${escapeHtml(pipeline.fromArtifact)} · preparing ${escapeHtml(pipeline.toAgent)}</em>` : ""}
    </div>
  `;
}

function runningProgressForAgent(index) {
  const micro = appState.workupMicro;
  if (index === 0) return `${Math.max(18, Math.min(88, micro.sourceRows * 12 + (micro.sourceLimits ? 26 : 0) + micro.sourceMatrixRows * 10))}%`;
  if (index === 1) return `${micro.spatialDetails ? 82 : micro.spatialBuffer ? 58 : micro.spatialZoom ? 34 : 18}%`;
  if (index === 2) return `${Math.max(16, Math.min(88, micro.hazardThemes * 8 + micro.dependencies * 7 + micro.gapItems * 7))}%`;
  if (index === 3) return `${Math.max(16, Math.min(92, micro.handoffVisible * 8 + micro.handoffReady * 8))}%`;
  return "50%";
}

function renderAgentActivityDetail(index, state, card) {
  if (state === "queued") return `<div class="agent-activity idle"></div>`;
  if (state === "completed") {
    const summaries = [
      ["5 sources checked", "3 context-only sources identified", "Case cannot close from selected information alone"],
      ["Point plus review buffer", "Method recorded", "Confidence recorded", "Site-specific review still required"],
      ["6 evidence gaps prepared", "Site-level evidence still required"],
      ["6 requests ready for review", "Decision record payload prepared"],
    ];
    return `
      <div class="agent-activity completed">
        ${summaries[index].map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    `;
  }
  if (index === 0) return renderSourceSuitabilityRun();
  if (index === 1) return renderSpatialContextRun();
  if (index === 2) return renderResilienceRun();
  if (index === 3) return renderHandoffRun();
  return `<div class="agent-activity"><p>${escapeHtml(card.activity)}</p></div>`;
}

function renderSourceSuitabilityRun() {
  const rowLabels = ["External signal", "Spatial layer", "Portfolio assumption", "Site note", "Continuity note"];
  const badgeLabels = ["Context-only", "Context-only", "Suitable", "Insufficient", "Context-only"];
  return `
    <div class="agent-activity source-run">
      ${renderCurrentFocus()}
      <div class="source-row-run">
        ${rowLabels
          .map(
            (label, index) => `
              <span class="${index < appState.workupMicro.sourceRows ? "validated" : ""}">
                ${escapeHtml(label)}
                ${appState.workupMicro.sourceLimits && index < appState.workupMicro.sourceRows ? `<em>${escapeHtml(badgeLabels[index])}</em>` : ""}
              </span>
            `,
          )
          .join("")}
      </div>
      <div class="matrix-run">
        ${[0, 1, 2].map((index) => `<i class="${index < appState.workupMicro.sourceMatrixRows ? "visible" : ""}"></i>`).join("")}
      </div>
    </div>
  `;
}

function renderCurrentFocus() {
  return `
    <div class="current-focus">
      <span>Current Focus</span>
      <p>${escapeHtml(currentPipelineState().currentFocus)}</p>
    </div>
  `;
}

function renderSpatialContextRun() {
  const micro = appState.workupMicro;
  return `
    <div class="agent-activity spatial-run">
      ${renderSpatialFocusSteps()}
      <div class="spatial-mini ${micro.spatialZoom ? "located" : ""} ${micro.spatialBuffer ? "buffered" : ""} ${micro.spatialContext ? "contexted" : ""}" aria-label="Spatial context schematic">
        <span class="spatial-context-patch">Screening context</span>
        <span class="spatial-water">River / surface water</span>
        <span class="spatial-road">Access / boundary</span>
        <span class="spatial-site">Site boundary</span>
        <span class="spatial-buffer">Review buffer</span>
        <span class="spatial-dot">Asset</span>
      </div>
      <dl class="spatial-detail-run">
        <div class="${micro.spatialBuffer ? "active" : ""}"><dt>Method</dt><dd>Review buffer</dd></div>
        <div class="${micro.spatialContext ? "active" : ""}"><dt>Confidence</dt><dd>Portfolio point</dd></div>
        <div class="${micro.spatialDetails ? "active" : ""}"><dt>Caveat</dt><dd>Site review required</dd></div>
      </dl>
    </div>
  `;
}

function renderSpatialFocusSteps() {
  const steps = [
    { label: "Locating asset point", complete: appState.workupMicro.spatialZoom },
    { label: "Applying review buffer", complete: appState.workupMicro.spatialBuffer },
    { label: "Linking nearby spatial context", complete: appState.workupMicro.spatialContext },
    { label: "Recording confidence and caveats", complete: appState.workupMicro.spatialDetails },
  ];
  const activeIndex = Math.max(0, steps.findIndex((step) => !step.complete));
  const nextStep = steps.slice(activeIndex + 1).find((step) => !step.complete);
  return `
    <div class="current-focus spatial-focus">
      <span>Current Focus</span>
      <div>
        ${steps
          .map(
            (step, index) => `
              <p class="${step.complete ? "complete" : index === activeIndex ? "active" : ""}">
                <i>${step.complete ? "✓" : index === activeIndex ? "•" : "○"}</i>
                ${escapeHtml(step.label)}${index === activeIndex && !step.complete ? "..." : ""}
              </p>
            `,
          )
          .join("")}
      </div>
      ${nextStep ? `<small>Next: ${escapeHtml(nextStep.label.toLowerCase())}</small>` : ""}
    </div>
  `;
}

function renderResilienceRun() {
  const hazards = ["Flood", "Heat", "Wind", "Power"];
  const dependencies = ["Cooling", "Drainage", "Backup power", "Water", "Engineering"];
  const gaps = ["Cooling redundancy", "Drainage drawings", "Backup power testing", "Utility dependency", "Water resilience", "Engineering records"];
  return `
    <div class="agent-activity resilience-run">
      ${renderCurrentFocus()}
      <div class="theme-row">
        ${hazards.map((item, index) => `<span class="${index < appState.workupMicro.hazardThemes ? "visible" : ""}">${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="dependency-row">
        ${dependencies.map((item, index) => `<span class="${index < appState.workupMicro.dependencies ? "visible" : ""}">${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="gap-board-run">
        ${gaps.map((gap, index) => `<i class="${index < appState.workupMicro.gapItems ? "visible" : ""}">${escapeHtml(gap)}</i>`).join("")}
      </div>
    </div>
  `;
}

function renderHandoffRun() {
  return `
    <div class="agent-activity handoff-run">
      ${renderCurrentFocus()}
      <div class="handoff-draft-strip">
        ${Array.from({ length: 6 }, (_, index) => {
          const visible = index < appState.workupMicro.handoffVisible;
          const ready = index < appState.workupMicro.handoffReady;
          return `<span class="${visible ? "visible" : ""} ${ready ? "ready" : ""}">${ready ? "Ready" : "Draft"}</span>`;
        }).join("")}
      </div>
    </div>
  `;
}

function renderActivityFeed() {
  if (!appState.workupRunning && !appState.workupRunComplete) return "";
  return `
    <section class="workup-activity-feed" aria-label="Specialist run activity">
      <span>Activity</span>
      ${appState.activityFeed.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
    </section>
  `;
}

function renderEvidenceRequestQueue(executionPlan) {
  const runState = workupRunState();
  const createdTasks = createdEvidenceTasks(executionPlan);
  const latestTask = latestCreatedEvidenceTask(executionPlan);
  const isHandoffRunning = appState.workupRunning && appState.workupRunStep === 3;
  if (isHandoffRunning) {
    const visibleTasks = executionPlan.evidenceTasks.slice(0, appState.workupMicro.handoffVisible);
    return `
      <aside class="evidence-queue-panel handoff" aria-label="Evidence request queue">
        <div class="workup-section-heading compact">
          <div>
            <p class="eyebrow">Evidence Request Queue</p>
            <h3>Drafting requests</h3>
          </div>
          <span>${appState.workupMicro.handoffReady} / ${executionPlan.evidenceTasks.length}</span>
        </div>
        <div class="queue-task-list">
          ${visibleTasks
            .map((task, index) => {
              const ready = index < appState.workupMicro.handoffReady;
              return `
                <article class="queue-task draft ${ready ? "ready" : ""}">
                  <div>
                    <span>${escapeHtml(task.owner)}</span>
                    <strong>${escapeHtml(task.label)}</strong>
                  </div>
                  <p>${escapeHtml(taskOrigin(task))}</p>
                  <em>${ready ? "Ready" : "Draft"}</em>
                </article>
              `;
            })
            .join("")}
        </div>
      </aside>
    `;
  }
  if (runState !== "completed") {
    return `
      <aside class="evidence-queue-panel locked ${appState.workupRunning ? "waiting" : ""}" aria-label="Evidence request queue">
        <div class="queue-lock" aria-hidden="true">
          <svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        </div>
        <p class="eyebrow">Evidence Request Queue</p>
        <h3>${appState.workupRunning ? "Waiting for outputs" : "Evidence Request Queue"}</h3>
        <p>${appState.workupRunning ? "Requests appear after the handoff is ready." : "Generated when the review package is ready."}</p>
        ${appState.workupRunning ? renderQueueWaitingState() : ""}
      </aside>
    `;
  }
  return `
    <aside class="evidence-queue-panel unlocked" aria-label="Evidence request queue">
      <div class="workup-section-heading compact">
        <div>
          <p class="eyebrow">Evidence Request Queue</p>
          <h3>Review-ready requests</h3>
        </div>
        <span>${executionPlan.evidenceTasks.length} ready</span>
      </div>
      ${
        latestTask
          ? `
            <div class="queue-feedback" role="status">
              <span>Request opened</span>
              <strong>${escapeHtml(latestTask.label)}</strong>
            </div>
          `
          : ""
      }
      <div class="queue-task-list">
        ${executionPlan.evidenceTasks
          .map((task) => {
            const isCreated = appState.createdTaskIds.has(task.id);
            return `
              <article class="queue-task ready ${isCreated ? "created" : ""}">
                <div>
                  <span>${escapeHtml(task.owner)}</span>
                  <strong>${escapeHtml(task.label)}</strong>
                </div>
                <p>${escapeHtml(taskOrigin(task))}</p>
                <em>${isCreated ? "Opened" : "Ready"}</em>
                <button type="button" data-task-id="${escapeHtml(task.id)}">${isCreated ? "Request opened" : "Open request"}</button>
              </article>
            `;
          })
          .join("")}
      </div>
    </aside>
  `;
}

function renderQueueWaitingState() {
  const waitingState = buildSpecialistWaitingState({
    workupRunning: appState.workupRunning,
    workupRunStep: appState.workupRunStep,
    workupRunEvent: appState.workupRunEvent,
    workupRunComplete: appState.workupRunComplete,
  });
  return `
    <div class="queue-waiting-list">
      ${waitingState
        .map(
          (item) => `
            <div class="${escapeHtml(item.state)}">
              <span>${item.state === "complete" ? "✓" : item.state === "running" ? "…" : "○"}</span>
              <strong>${escapeHtml(item.label)}</strong>
              <em>${item.state === "complete" ? "Complete" : item.state === "running" ? "Running..." : "Queued..."}</em>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderPreparationDetails(workup, spatialWorkup, executionPlan) {
  if (!appState.workupRunComplete) return "";
  return `
    <section class="preparation-details-panel">
      <details>
        <summary>
            <span>Details</span>
            <strong>Open review package</strong>
        </summary>
        <div class="preparation-detail-grid">
          <article>
            <span>Source suitability matrix</span>
            <h4>${escapeHtml(workup.selectedSourceCount)} sources checked</h4>
            ${list(workup.sourceSuitability.map((source) => `${source.name}: ${source.caveat}`))}
          </article>
          <article>
            <span>Spatial context note</span>
            <h4>${escapeHtml(spatialWorkup.assetGeometry.workingGeometry)}</h4>
            <p>${escapeHtml(spatialWorkup.professionalBoundary)}</p>
          </article>
          <article>
            <span>Resilience gap board</span>
            <h4>${escapeHtml(workup.resilienceEvidenceGaps.length)} evidence gaps</h4>
            ${list(workup.resilienceEvidenceGaps.map((gap) => gap.label))}
          </article>
          <article>
            <span>Review note</span>
            <h4>Reviewer action still required</h4>
            <p>${escapeHtml(executionPlan.primaryNextStep)}</p>
          </article>
          <article class="voice-ready">
            <span>Demo summary</span>
            <h4>Prepared for a recorded demo</h4>
            <p>Source suitability, spatial context, resilience gaps, and requests are ready. The reviewer still owns the business decision.</p>
          </article>
        </div>
      </details>
    </section>
  `;
}

function renderExecutionConsole(executionPlan) {
  return `
    <article class="execution-console wide">
      <div class="panel-top">
        <span class="panel-index">NOW</span>
        <div>
          <h3>Why the case cannot close automatically</h3>
          <p>The system has not made a decision. It has created the work needed for the next human action.</p>
        </div>
      </div>
      <div class="blocker-grid">
        ${executionPlan.blockers
          .map(
            (blocker) => `
              <section class="blocker-card">
                <strong>${escapeHtml(blocker.title)}</strong>
                <p>${escapeHtml(blocker.reason)}</p>
              </section>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderEvidenceTaskBoard(executionPlan) {
  return `
    <article class="execution-console wide">
      <div class="panel-top">
        <span class="panel-index">TASKS</span>
        <div>
          <h3>Evidence request queue</h3>
          <p>${executionPlan.evidenceTasks.length} requests are ready for review.</p>
        </div>
      </div>
      <div class="task-board">
        ${executionPlan.evidenceTasks
          .map((task) => {
            const isCreated = appState.createdTaskIds.has(task.id);
            return `
              <section class="task-card ${isCreated ? "created" : ""}">
                <div>
                  <span>${escapeHtml(task.owner)}</span>
                  <strong>${escapeHtml(task.label)}</strong>
                </div>
                <p>${escapeHtml(task.request)}</p>
                <button type="button" data-task-id="${escapeHtml(task.id)}">${isCreated ? "Request opened" : "Open request"}</button>
              </section>
            `;
          })
          .join("")}
      </div>
    </article>
  `;
}

function renderHumanGatePanel(executionPlan) {
  return `
    <article class="execution-console">
      <div class="panel-top">
        <span class="panel-index">REVIEW</span>
        <div>
          <h3>Reviewer actions</h3>
          <p>The reviewer chooses the business action after evidence is requested or checked.</p>
        </div>
      </div>
      <div class="handoff-list">
        ${executionPlan.handoffActions
          .map(
            (action) => `
              <button class="handoff-action" type="button" data-action-id="${escapeHtml(action.id)}">
                <strong>${escapeHtml(action.label)}</strong>
                <span>${escapeHtml(action.description)}</span>
              </button>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderSupportingDetails(workup, spatialWorkup, executionPlan) {
  return `
    <article class="execution-console">
      <div class="panel-top">
        <span class="panel-index">DETAIL</span>
        <div>
          <h3>Supporting detail</h3>
          <p>Open only when a reviewer needs to check why the task was created.</p>
        </div>
      </div>
      <details>
        <summary>Spatial method and source caveats</summary>
        ${renderSpatialWorkbench(spatialWorkup)}
      </details>
      ${executionPlan.supportingDetails
        .map(
          (detail) => `
            <details>
              <summary>${escapeHtml(detail.title)}</summary>
              ${list(detail.items)}
            </details>
          `,
        )
        .join("")}
    </article>
  `;
}

function renderSpatialWorkbench(spatialWorkup) {
  const activeDiagnostic =
    spatialWorkup.sourceDiagnostics.find((row) => row.id === appState.activeGeoSourceId) ??
    spatialWorkup.sourceDiagnostics[0];
  return `
    <article class="geo-workbench">
      <div class="geo-header">
        <div>
          <p class="eyebrow">Spatial review</p>
          <h3>How spatial context is prepared</h3>
          <p>This shows the review layer: geometry, native scale, method choice, uncertainty, and caveat handling.</p>
        </div>
        <div class="geo-asset">
          <span>Working geometry</span>
          <strong>${escapeHtml(spatialWorkup.assetGeometry.workingGeometry)}</strong>
          <small>${escapeHtml(spatialWorkup.assetGeometry.locationConfidence)}</small>
        </div>
      </div>
      <div class="geo-layout">
        <div class="geo-operations">
          <h4>Operations</h4>
          ${list(spatialWorkup.operations)}
        </div>
        <div class="geo-diagnostics">
          <h4>Source queue</h4>
          <div class="geo-source-list">
            ${spatialWorkup.sourceDiagnostics
              .map(
                (row) => `
                  <button class="geo-source ${row.id === activeDiagnostic?.id ? "active" : ""}" type="button" data-geo-source="${escapeHtml(row.id)}">
                    <strong>${escapeHtml(row.name)}</strong>
                    <span>${escapeHtml(row.nativeScale)}</span>
                  </button>
                `,
              )
              .join("")}
          </div>
          ${
            activeDiagnostic
              ? `
                <div class="geo-detail">
                  <span>Selected source</span>
                  <h4>${escapeHtml(activeDiagnostic.name)}</h4>
                  <dl>
                    <div><dt>Native scale</dt><dd>${escapeHtml(activeDiagnostic.nativeScale)}</dd></div>
                    <div><dt>Horizon</dt><dd>${escapeHtml(activeDiagnostic.horizon)}</dd></div>
                    <div><dt>Method</dt><dd>${escapeHtml(activeDiagnostic.spatialMethod)}</dd></div>
                    <div><dt>Review use</dt><dd>${escapeHtml(activeDiagnostic.reviewUse)}</dd></div>
                    <div><dt>Confidence</dt><dd>${escapeHtml(activeDiagnostic.confidence)}</dd></div>
                    <div><dt>Caveat</dt><dd>${escapeHtml(activeDiagnostic.caveat)}</dd></div>
                  </dl>
                </div>
              `
              : ""
          }
        </div>
      </div>
      <p class="geo-boundary">${escapeHtml(spatialWorkup.professionalBoundary)}</p>
    </article>
  `;
}

function renderReview() {
  const selectedAction = reviewActions.find((action) => action.id === appState.selectedActionId) ?? reviewActions[0];
  const workflowPayload = currentWorkflowPayload();
  const executionPlan = workflowPayload.executionPlan;
  const openedCount = executionPlan.createdEvidenceRequestCount;
  return `
    <section class="review-console">
      <div class="review-header">
        <div>
          <p class="eyebrow">Review decision</p>
          <h2>Human review task model</h2>
          <p>The review package is ready. The reviewer resolves open questions and owns the decision.</p>
        </div>
        <div class="review-task">
          <span>Assigned to</span>
          <strong>Portfolio risk reviewer</strong>
          <small>Before renewal file closure</small>
        </div>
      </div>
      ${renderReviewHazardMapContext()}
      <div class="review-grid">
        <article class="review-reason">
          <h3>Why this task exists</h3>
          <ol>
            <li>External signals are useful as context, not site clearance.</li>
            <li>Spatial scale, time horizon, and source purpose need explicit caveats.</li>
            <li>Data-centre resilience evidence is incomplete for the current review file.</li>
          </ol>
        </article>
        <article class="evidence-checklist">
          <h3>Evidence checklist</h3>
          <div class="check-row done"><span></span><p>Source suitability matrix prepared</p></div>
          <div class="check-row done"><span></span><p>Spatial and temporal context recorded</p></div>
          <div class="check-row done"><span></span><p>Review-ready evidence requests available: ${executionPlan.evidenceTasks.length}</p></div>
          <div class="check-row ${openedCount > 0 ? "done" : "warn"}"><span></span><p>Requests opened by reviewer: ${openedCount} / ${executionPlan.evidenceTasks.length}</p></div>
          <div class="check-row ${appState.selectedSourceIds.has("site_resilience_notes") ? "warn" : "missing"}"><span></span><p>Current site resilience file incomplete</p></div>
          <div class="check-row ${selectedAction.id === "refer_risk_engineering" ? "done" : "warn"}"><span></span><p>Risk-engineering evidence owner ${selectedAction.id === "refer_risk_engineering" ? "selected for referral" : "not confirmed"}</p></div>
          <div class="review-task-list">
            ${executionPlan.evidenceTasks
              .map(
                (task) => `
                  <div class="review-task-row ${task.status === "Request created" ? "done" : "pending"}">
                    <strong>${escapeHtml(task.label)}</strong>
                    <span>${task.status === "Request created" ? "Opened" : "Ready"}</span>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>
        <article class="review-actions">
          <h3>Available reviewer actions</h3>
          ${reviewActions
            .map(
              (action) => `
                <button class="action-card ${action.id === appState.selectedActionId ? "selected" : ""}" type="button" data-action-id="${escapeHtml(action.id)}">
                  <span>${escapeHtml(action.type)}</span>
                  <h4>${escapeHtml(action.label)}</h4>
                  <p>${escapeHtml(action.description)}</p>
                </button>
              `,
            )
            .join("")}
          <button class="primary-action" type="button" data-view="record"><span>Create decision record</span>${buttonArrow()}</button>
        </article>
      </div>
    </section>
  `;
}

function renderRecord() {
  const decisionRecord = currentDecisionRecord();
  const workflowPayload = currentWorkflowPayload();
  const workup = workflowPayload.professionalWorkup;
  const executionPlan = workflowPayload.executionPlan;
  const openedRequestLabels = executionPlan.evidenceTasks
    .filter((task) => task.status === "Request created")
    .map((task) => task.label);
  const recordJson = JSON.stringify(
    {
      ...(appState.bridge.finalPayload ?? workflowPayload),
      bridge: bridgeSnapshot(),
      generatedAt: new Date().toISOString(),
    },
    null,
    2,
  );
  return `
    <section class="record-shell">
      <div class="record-header">
        <div>
          <p class="eyebrow">Decision record</p>
          <h2>Audit-ready record</h2>
          <p>Evidence trail, reviewer action, caveats, and outcome are saved for audit.</p>
        </div>
        <span class="record-badge">Audit-ready record</span>
      </div>
      <div class="record-layout">
        <article class="record-summary">
          <dl>
            <div><dt>Case ID</dt><dd>${escapeHtml(decisionRecord.caseId)}</dd></div>
            <div><dt>Asset</dt><dd>${escapeHtml(decisionRecord.asset)}</dd></div>
            <div><dt>Review</dt><dd>${escapeHtml(decisionRecord.reviewType)}</dd></div>
            <div><dt>Status</dt><dd>${escapeHtml(decisionRecord.status)}</dd></div>
            <div><dt>Selected action</dt><dd>${escapeHtml(decisionRecord.selectedActionId)}</dd></div>
          </dl>
        </article>
        <article class="record-card">
          <h3>Review package</h3>
          <p>${escapeHtml(workup.summary)}</p>
        </article>
        <article class="record-card">
          <h3>Package contents</h3>
          <p>${escapeHtml(workup.selectedSourceCount)} sources · ${escapeHtml(workup.resilienceEvidenceGaps.length)} evidence gaps · ${escapeHtml(workup.reviewQuestions.length)} reviewer questions.</p>
        </article>
        <article class="record-card">
          <h3>Evidence requests</h3>
          <p>${escapeHtml(executionPlan.evidenceTasks.length)} review-ready requests prepared${openedRequestLabels.length ? `; ${escapeHtml(openedRequestLabels.length)} opened: ${escapeHtml(openedRequestLabels.join(", "))}` : "."}</p>
        </article>
        <article class="record-card">
          <h3>Reviewer action</h3>
          <p>${escapeHtml(decisionRecord.nextAction)}</p>
        </article>
        <article class="record-card boundary">
          <h3>Caveats and boundary</h3>
          <p>${escapeHtml(decisionRecord.boundary)}</p>
        </article>
        <article class="record-card">
          <h3>Outcome</h3>
          <p>${escapeHtml(workflowPayload.stages.map((stage) => stage.id).join(" → "))}</p>
        </article>
        <article class="trace-card">
          <h3>Evidence trail</h3>
          ${decisionRecord.auditTrail
            .map((step, index) => `<div class="trace-step"><span>${String(index + 1).padStart(2, "0")}</span><p>${escapeHtml(step)}</p></div>`)
            .join("")}
        </article>
        <article class="record-json ${appState.recordJsonOpen ? "record-json-open" : "record-json-collapsed"}">
          <div class="record-json-top">
            <div>
              <h3>Technical payload</h3>
              <p>JSON payload available for downstream workflow handoff.</p>
            </div>
            <div class="record-json-actions">
              <button type="button" data-export-record>Download JSON</button>
              <button type="button" data-toggle-record-json>${appState.recordJsonOpen ? "Hide payload" : "Show payload"}</button>
            </div>
          </div>
          ${appState.recordJsonOpen ? `<pre>${escapeHtml(recordJson)}</pre>` : ""}
        </article>
      </div>
    </section>
  `;
}

function startSpecialistWorkup() {
  clearWorkupTimers();
  resetWorkupMicroState();
  appState.workupRunning = true;
  appState.workupRunComplete = false;
  appState.workupRunStep = 0;
  appState.workupRunEvent = "source-scale";
  pushActivity("Checking source suitability...");
  void runBridgeWorkup();
  selectView("workup");

  const schedule = (delay, update) => {
    workupRunTimers.push(
      setTimeout(() => {
        update();
        selectView("workup");
      }, delay),
    );
  };

  schedule(300, () => {
    appState.workupMicro.sourceRows = 1;
  });
  schedule(700, () => {
    appState.workupMicro.sourceRows = 3;
  });
  schedule(1100, () => {
    appState.workupMicro.sourceRows = 5;
    pushActivity("Five source rows validated.");
  });
  schedule(1400, () => {
    appState.workupRunEvent = "source-limits";
    appState.workupMicro.sourceLimits = true;
    pushActivity("Three context-only datasets identified.");
  });
  schedule(1750, () => {
    appState.workupRunEvent = "source-matrix";
    appState.workupMicro.sourceMatrixRows = 1;
  });
  schedule(2050, () => {
    appState.workupMicro.sourceMatrixRows = 3;
  });
  schedule(pipelineTiming.stages.sourceSuitability.handoffAtMs, () => {
    appState.workupRunEvent = "handoff-source-spatial";
    pushActivity("Source Suitability Matrix passed downstream.");
  });
  schedule(pipelineTiming.stages.sourceSuitability.nextAtMs, () => {
    appState.workupRunStep = 1;
    appState.workupRunEvent = "spatial-footprint";
    pushActivity("Case cannot close from evidence package alone.");
  });

  schedule(3200, () => {
    appState.workupMicro.spatialZoom = true;
  });
  schedule(3700, () => {
    appState.workupRunEvent = "spatial-buffer";
    appState.workupMicro.spatialBuffer = true;
    pushActivity("Review buffer created.");
  });
  schedule(4200, () => {
    appState.workupRunEvent = "spatial-context";
    appState.workupMicro.spatialContext = true;
    pushActivity("Nearby spatial context linked.");
  });
  schedule(4750, () => {
    appState.workupRunEvent = "spatial-caveats";
    appState.workupMicro.spatialDetails = true;
  });
  schedule(pipelineTiming.stages.spatialContext.handoffAtMs, () => {
    appState.workupRunEvent = "handoff-spatial-resilience";
    pushActivity("Spatial Context Note passed downstream.");
  });
  schedule(pipelineTiming.stages.spatialContext.nextAtMs, () => {
    appState.workupRunStep = 2;
    appState.workupRunEvent = "resilience-hazards";
    pushActivity("Confidence and caveats recorded.");
  });

  schedule(6050, () => {
    appState.workupMicro.hazardThemes = 1;
  });
  schedule(6450, () => {
    appState.workupMicro.hazardThemes = 2;
  });
  schedule(6850, () => {
    appState.workupMicro.hazardThemes = 3;
  });
  schedule(7250, () => {
    appState.workupMicro.hazardThemes = 4;
    pushActivity("Hazard themes mapped.");
  });
  schedule(7600, () => {
    appState.workupRunEvent = "resilience-dependencies";
    appState.workupMicro.dependencies = 1;
  });
  schedule(8000, () => {
    appState.workupMicro.dependencies = 3;
  });
  schedule(8400, () => {
    appState.workupMicro.dependencies = 5;
    pushActivity("Resilience dependencies checked.");
  });
  schedule(8700, () => {
    appState.workupRunEvent = "resilience-gaps";
    appState.workupMicro.gapItems = 1;
  });
  schedule(8880, () => {
    appState.workupMicro.gapItems = 2;
  });
  schedule(9060, () => {
    appState.workupMicro.gapItems = 3;
  });
  schedule(9240, () => {
    appState.workupMicro.gapItems = 4;
  });
  schedule(9420, () => {
    appState.workupMicro.gapItems = 5;
  });
  schedule(9600, () => {
    appState.workupMicro.gapItems = 6;
  });
  schedule(pipelineTiming.stages.dataCentreResilience.handoffAtMs, () => {
    appState.workupRunEvent = "handoff-resilience-workflow";
    pushActivity("Evidence gap added.");
  });
  schedule(pipelineTiming.stages.dataCentreResilience.nextAtMs, () => {
    appState.workupRunStep = 3;
    appState.workupRunEvent = "handoff-convert";
    pushActivity("Resilience Gap Board passed downstream.");
  });

  [0, 1, 2, 3, 4, 5].forEach((index) => {
    schedule(10450 + index * pipelineTiming.queueCadenceMs, () => {
      appState.workupRunEvent = "handoff-draft";
      appState.workupMicro.handoffVisible = Math.max(appState.workupMicro.handoffVisible, index + 1);
      pushActivity("Request drafted.");
    });
    schedule(10680 + index * pipelineTiming.queueCadenceMs, () => {
      appState.workupRunEvent = "handoff-ready";
      appState.workupMicro.handoffReady = Math.max(appState.workupMicro.handoffReady, index + 1);
    });
  });

  schedule(pipelineTiming.totalMs, () => {
    appState.workupMicro.handoffVisible = 6;
    appState.workupMicro.handoffReady = 6;
    appState.workupRunning = false;
    appState.workupRunComplete = true;
    appState.workupRunStep = 4;
    appState.workupRunEvent = "completed";
    pushActivity("Six review-ready evidence requests prepared.");
    workupRunTimers = [];
  });
}

function selectView(viewName) {
  const view = views[viewName] ? viewName : "case";
  appState.view = view;
  if (view === "record") appState.recordGenerated = true;
  document.body.dataset.activeView = view;
  const workflowHost = document.querySelector("#workflow-host");
  if (workflowHost) workflowHost.innerHTML = renderWorkflowStrip(view);
  renderBridgeHost();
  const workflowNav = document.querySelector(".workflow-nav");
  if (workflowNav) workflowNav.innerHTML = renderWorkflowSidebar(view);
  document.querySelector("#app").innerHTML = (view === "workup" ? "" : renderStepHero(view)) + views[view]();
  if (view === "record") void refreshBridgeFinalPayload();
  if (document.querySelector("[data-hazard-map]")) {
    window.requestAnimationFrame(() => {
      initEmbeddedHazardMap().catch((error) => {
        const root = document.querySelector("[data-hazard-map]");
        if (!root) return;
        root.innerHTML = `
          <div class="hazard-map-error">
            <strong>Processed hazard map failed to load</strong>
            <span>${escapeHtml(error.message || error)}</span>
          </div>
        `;
      });
    });
  } else if (embeddedHazardMap) {
    embeddedHazardMap.remove();
    embeddedHazardMap = null;
  }
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => selectView(button.dataset.view));
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  const view = button?.dataset?.view ?? event.target?.dataset?.view;
  if (view) selectView(view);
  const mapControl = button?.dataset?.hazardMapControl;
  if (mapControl && embeddedHazardMap) {
    event.preventDefault();
    if (mapControl === "reset") embeddedHazardMap.setView(hazardInitialView.center, hazardInitialView.zoom, { animate: true });
    if (mapControl === "zoom-in") embeddedHazardMap.zoomIn(1);
    if (mapControl === "zoom-out") embeddedHazardMap.zoomOut(1);
    return;
  }
  const scenario = button?.dataset?.scenario;
  if (scenario) {
    appState.activeScenario = scenario;
    resetWorkflowBridge("Scenario changed");
    selectView("case");
  }
  const actionId = button?.dataset?.actionId;
  if (actionId) {
    appState.selectedActionId = actionId;
    void captureBridgeHumanAction(actionId);
    selectView("review");
  }
  const geoSourceId = button?.dataset?.geoSource;
  if (geoSourceId) {
    appState.activeGeoSourceId = geoSourceId;
    selectView("workup");
  }
  const taskId = button?.dataset?.taskId;
  if (taskId) {
    appState.createdTaskIds.add(taskId);
    void createBridgeEvidenceRequest(taskId);
    selectView("workup");
  }
  if (button?.dataset?.runWorkup !== undefined) {
    startSpecialistWorkup();
  }
  const guideNext = button?.dataset?.guideNext;
  if (guideNext) {
    selectView(guideNext);
  }
  if (button?.dataset?.exportRecord !== undefined) {
    downloadRecord();
  }
  if (button?.dataset?.toggleRecordJson !== undefined) {
    appState.recordJsonOpen = !appState.recordJsonOpen;
    selectView("record");
  }
});

document.addEventListener("change", (event) => {
  const sourceId = event.target?.dataset?.sourceId;
  if (!sourceId) return;
  if (event.target.checked) {
    appState.selectedSourceIds.add(sourceId);
  } else if (appState.selectedSourceIds.size > 1) {
    appState.selectedSourceIds.delete(sourceId);
  } else {
    event.target.checked = true;
  }
  resetWorkflowBridge("Selected sources changed");
  selectView("inputs");
});

function downloadRecord() {
  const decisionRecord = currentDecisionRecord();
  const payload = {
    ...(appState.bridge.finalPayload ?? currentWorkflowPayload()),
    bridge: bridgeSnapshot(),
    generatedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${decisionRecord.caseId.toLowerCase()}-uipath-workflow-payload.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

const initialView = new URLSearchParams(window.location.search).get("view");
selectView(initialView ?? "case");
