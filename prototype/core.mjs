export function labelFromId(id) {
  const words = id
    .split("_")
    .filter(Boolean)
    .join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function buildSourceRows(sources) {
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    type: source.source_type ?? "Unspecified source",
    hazards: source.hazards ?? [],
    scale: source.granularity ?? "Unknown scale",
    horizon: source.time_horizon ?? "Unknown horizon",
    usefulFor: (source.useful_for ?? []).join(", "),
    limits: (source.cannot_support ?? []).join(", "),
    caveat: source.caveat ?? "No caveat recorded.",
  }));
}

export function getMustShowSections(caseData) {
  return (caseData.workup?.must_show ?? []).map(labelFromId);
}

export function buildReviewActions(caseData) {
  return [
    {
      id: "request_site_evidence",
      label: "Request site-level evidence",
      type: "Default action",
      isDefault: true,
      description: caseData.workup.recommended_next_action,
    },
    {
      id: "refer_risk_engineering",
      label: "Refer to risk engineering",
      type: "Alternative",
      isDefault: false,
      description:
        "Refer to risk engineering for decision-grade engineering assessment if evidence remains incomplete.",
    },
    {
      id: "keep_under_review",
      label: "Keep under review with caveat",
      type: "Alternative",
      isDefault: false,
      description:
        "Keep the asset under review when closure depends on additional evidence or committee review.",
    },
  ];
}

function selectedSourcesFor(caseData, selectedSourceIds = null) {
  const sourceIds = selectedSourceIds ?? caseData.sources.map((source) => source.id);
  const selectedIds = new Set(sourceIds);
  return caseData.sources.filter((source) => selectedIds.has(source.id));
}

function buildResilienceEvidenceGaps() {
  return [
    {
      id: "site_asset_basis",
      label: "Site and asset basis",
      neededEvidence: "Location basis, campus boundary or asset point, IT load, rack density, and critical dependencies.",
    },
    {
      id: "flood_surface_water_controls",
      label: "Flood and surface-water controls",
      neededEvidence: "Floor levels, drainage design, critical equipment elevation, flood barriers, access-road exposure, and maintenance records.",
    },
    {
      id: "power_continuity",
      label: "Power continuity",
      neededEvidence: "Utility feeds, UPS, ATS, switchgear, standby generators, fuel duration, and test logs.",
    },
    {
      id: "cooling_continuity",
      label: "Cooling continuity",
      neededEvidence: "Chiller / CRAH / CRAC redundancy, heat-stress limits, cooling ride-through, and loss-of-cooling procedures.",
    },
    {
      id: "water_dependency",
      label: "Water dependency",
      neededEvidence: "Water source, WUE, cooling-tower demand, drought restrictions, and backup water plan.",
    },
    {
      id: "risk_engineering_record",
      label: "Risk-engineering record",
      neededEvidence: "Inspection date, open recommendations, evidence owner, and next review date.",
    },
  ];
}

export function buildHazardEvidenceInterpretation() {
  return [
    {
      hazard: "Flood / surface water",
      whyItMatters: "Data-centre downtime can be driven by flooded plant, access routes, switchgear, drainage failure, or low-lying critical equipment.",
      evidenceRequest: "Ask for site drainage design, floor levels, freeboard, critical equipment elevation, barriers, access-road floodability, and maintenance records.",
      boundary: "This supports review scoping; it does not certify flood protection or clear the site.",
    },
    {
      hazard: "Extreme heat",
      whyItMatters: "Heat stress can affect cooling capacity, server inlet temperature, equipment derating, and emergency procedures.",
      evidenceRequest: "Ask for cooling redundancy, ASHRAE / OEM operating limits, server inlet temperature thresholds, cooling ride-through, and loss-of-cooling procedures.",
      boundary: "This supports review questions; it does not validate thermal design or engineering resilience.",
    },
    {
      hazard: "Power continuity",
      whyItMatters: "Grid interruption, switchgear exposure, generator performance, fuel logistics, and ATS / UPS configuration can drive outage risk.",
      evidenceRequest: "Ask for utility feeds, UPS configuration, ATS and switchgear records, generator capacity, fuel duration, test logs, and single-point-of-failure review.",
      boundary: "This supports review evidence preparation; it does not prove uptime, redundancy class, or loss estimate.",
    },
    {
      hazard: "Cooling / water dependency",
      whyItMatters: "Cooling systems may depend on water availability, chiller performance, cooling-tower operation, and local operating restrictions.",
      evidenceRequest: "Ask for WUE, water source, backup water plan, cooling-tower demand, drought restriction exposure, and cooling contingency procedure.",
      boundary: "This supports dependency review preparation; it does not validate operational readiness.",
    },
    {
      hazard: "Wind / storm",
      whyItMatters: "Storms can affect roof and envelope integrity, yard equipment, utility feeds, access, fuel replenishment, and supplier continuity.",
      evidenceRequest: "Ask for roof and envelope inspection, yard-equipment anchorage, storm-response plan, backup fuel logistics, and open risk-engineering recommendations.",
      boundary: "This supports review preparation; it does not create an engineering conclusion.",
    },
    {
      hazard: "Business interruption context",
      whyItMatters: "The same physical trigger may matter differently depending on SLA exposure, redundancy, customers, cloud region role, and recovery assumptions.",
      evidenceRequest: "Ask for SLA exposure, RTO / RPO, customer criticality, dependency mapping, contingency plan, and internal BI assumptions.",
      boundary: "This supports reviewer context; it does not estimate BI, MFL, PML, or pricing.",
    },
  ];
}

function buildReviewQuestions() {
  return [
    "Which site-level evidence is needed before the current portfolio assumption can be kept unchanged?",
    "Which external signals are only suitable as review triggers rather than asset-level evidence?",
      "Which hazards need follow-up: flood / surface water, heat, wind, water dependency, power, cooling, or BI?",
    "Which caveats must be recorded before this case is closed?",
    "Who should own the next evidence request: asset owner, broker, risk engineering, or portfolio team?",
  ];
}

function buildEnterpriseControls() {
  return {
    queueName: "DataCentrePhysicalRiskReview",
    slaHours: 48,
    retryPolicy: {
      maxAttempts: 2,
      retryAfterHours: 24,
      retryReason: "Evidence owner has not returned the required site-level evidence.",
    },
    escalationPath: [
      {
        stage: "evidence_missing_after_sla",
        owner: "Portfolio risk lead",
        action: "Escalate missing evidence and keep the case open.",
      },
      {
        stage: "manual_override_requested",
        owner: "Risk engineering",
        action: "Review whether a caveated decision record is acceptable.",
      },
    ],
    manualOverrideAllowed: true,
    auditEvents: [
      "queue_item_created",
      "source_pack_loaded",
      "specialist_workup_completed",
      "evidence_request_created",
      "human_review_task_modeled",
      "reviewer_action_captured",
      "decision_packet_generated",
    ],
  };
}

function buildAuditStageStatus(
  caseData,
  selectedActionId,
  createdEvidenceRequestIds,
  { selectedSourceCount, evidenceTaskCount } = {},
) {
  const evidenceRequestCreated = createdEvidenceRequestIds.length > 0;
  return {
    queueIntake: {
      status: "complete",
      event: "queue_created",
      queueName: "DataCentrePhysicalRiskReview",
      reference: caseData.case_id,
      integrationMode: "queue_compatible_payload",
      liveQueueSubmitted: false,
    },
    sourcePack: {
      status: "complete",
      event: "source_pack_loaded",
      selectedSourceCount,
    },
    specialistWorkup: {
      status: "complete",
      event: "workup_completed",
      evidenceTaskCount,
    },
    evidenceRequest: {
      status: evidenceRequestCreated ? "created" : "pending",
      event: "evidence_request_created",
      primaryRequestId: "site_asset_basis",
      createdEvidenceRequestIds,
    },
    humanAction: {
      status: "captured",
      event: "human_action_captured",
      selectedActionId,
      integrationMode: "human_task_model",
      liveActionCenterTaskCreated: false,
    },
    decisionPacket: {
      status: "generated",
      event: "decision_packet_generated",
      recordType: "workflow_decision_packet",
    },
  };
}

function buildAuditEventHistory(stageStatus) {
  return [
    {
      event: "queue_created",
      stage: "case_intake",
      actor: "UiPath workflow",
      summary: `Queue-compatible case payload created for ${stageStatus.queueIntake.reference}.`,
    },
    {
      event: "source_pack_loaded",
      stage: "load_source_pack",
      actor: "Edgion source agent",
      summary: `${stageStatus.sourcePack.selectedSourceCount} source records loaded with scale, horizon, use, and caveats.`,
    },
    {
      event: "workup_completed",
      stage: "run_specialist_workup",
      actor: "Edgion specialist agents",
      summary: `${stageStatus.specialistWorkup.evidenceTaskCount} evidence tasks identified for review.`,
    },
    {
      event: stageStatus.evidenceRequest.status === "created" ? "evidence_request_created" : "evidence_request_pending",
      stage: "create_evidence_request_sla",
      actor: "UiPath workflow controls",
      summary:
        stageStatus.evidenceRequest.status === "created"
          ? `Primary evidence request created: ${stageStatus.evidenceRequest.primaryRequestId}.`
          : `Primary evidence request pending: ${stageStatus.evidenceRequest.primaryRequestId}.`,
    },
    {
      event: "human_action_captured",
      stage: "capture_human_action",
      actor: "Human reviewer",
      summary: `Reviewer action captured: ${stageStatus.humanAction.selectedActionId}.`,
    },
    {
      event: "decision_packet_generated",
      stage: "generate_audit_decision_packet",
      actor: "UiPath / Edgion record agent",
      summary: "Audit decision packet generated with case state, evidence context, human action, and boundaries.",
    },
  ];
}

function buildAuditOutput(caseData, selectedActionId, createdEvidenceRequestIds, { selectedSourceCount, evidenceTaskCount } = {}) {
  const stageStatus = buildAuditStageStatus(caseData, selectedActionId, createdEvidenceRequestIds, {
    selectedSourceCount,
    evidenceTaskCount,
  });
  return {
    recordType: "workflow_decision_packet",
    caseId: caseData.case_id,
    reference: caseData.case_id,
    selectedActionId,
    createdEvidenceRequestIds,
    stageStatus,
    eventHistory: buildAuditEventHistory(stageStatus),
    evidenceRequestScope: {
      identifiedEvidenceTaskCount: evidenceTaskCount,
      primaryRequestId: "site_asset_basis",
      primaryRequestCreated: createdEvidenceRequestIds.includes("site_asset_basis"),
      note:
        "Six evidence tasks are identified; this workflow creates the primary site_asset_basis request before human review and leaves the remaining tasks available for follow-up.",
    },
    payloadSections: ["queueItem", "professionalWorkup", "executionPlan", "humanTask", "decisionRecord"],
    boundary:
      "Audit packet supports governed review preparation only; it is not an underwriting, pricing, site-clearance, or engineering-certification output.",
  };
}

export function buildProfessionalWorkupPayload(
  caseData,
  { selectedSourceIds = null, activeScenario = "multi-hazard" } = {},
) {
  const selectedSources = selectedSourcesFor(caseData, selectedSourceIds);
  const sourceIds = selectedSources.map((source) => source.id);
  const sourceSuitability = selectedSources.map((source) => ({
    id: source.id,
    name: source.name,
    sourceType: source.source_type ?? "Unspecified source",
    hazards: source.hazards ?? [],
    nativeScale: source.granularity ?? "Unknown scale",
    timeHorizon: source.time_horizon ?? "Unknown horizon",
    usefulFor: source.useful_for ?? [],
    cannotSupport: source.cannot_support ?? [],
    caveat: source.caveat ?? "No caveat recorded.",
  }));
  return {
    caseId: caseData.case_id,
    activeScenario,
    primaryQuestion:
      caseData.review.primary_question ??
      "What evidence and caveats should the reviewer consider before deciding the next action?",
    selectedSourceIds: sourceIds,
    selectedSourceCount: sourceIds.length,
    summary: `Review package across ${sourceIds.length} selected sources: source suitability, spatial and temporal context, resilience gaps, caveats, and reviewer questions.`,
    requiredSections: getMustShowSections(caseData),
    sourceSuitability,
    spatialTemporalContext: buildSpatialWorkup(caseData, sourceIds),
    hazardEvidenceInterpretation: buildHazardEvidenceInterpretation(),
    resilienceEvidenceGaps: buildResilienceEvidenceGaps(),
    reviewQuestions: buildReviewQuestions(),
    professionalBoundary: caseData.workup.boundary,
  };
}

export function buildWorkupExecutionPlan(
  caseData,
  { selectedSourceIds = null, activeScenario = "multi-hazard", createdTaskIds = [] } = {},
) {
  const workup = buildProfessionalWorkupPayload(caseData, { selectedSourceIds, activeScenario });
  const enterpriseControls = buildEnterpriseControls();
  const createdIds = new Set(createdTaskIds);
  const evidenceTasks = workup.resilienceEvidenceGaps.map((gap) => {
    const owner = gap.id === "risk_engineering_record" ? "Risk engineering" : "Asset owner / broker";
    return {
      id: gap.id,
      label: gap.label,
      owner,
      request: gap.neededEvidence,
      status: createdIds.has(gap.id) ? "Request created" : "Needs request",
      slaHours: enterpriseControls.slaHours,
      retry: {
        maxAttempts: enterpriseControls.retryPolicy.maxAttempts,
        retryAfterHours: enterpriseControls.retryPolicy.retryAfterHours,
      },
      escalationOwner: gap.id === "risk_engineering_record" ? "Risk engineering" : "Portfolio risk lead",
      exceptionState: createdIds.has(gap.id) ? "waiting_for_evidence" : "evidence_request_required",
    };
  });
  const createdEvidenceRequestIds = evidenceTasks
    .filter((task) => task.status === "Request created")
    .map((task) => task.id);
  return {
    status: "Reviewer action required",
    primaryNextStep: caseData.workup.recommended_next_action,
    createdEvidenceRequestCount: createdEvidenceRequestIds.length,
    createdEvidenceRequestIds,
    evidenceRequestPolicy: {
      identifiedEvidenceTaskCount: evidenceTasks.length,
      primaryRequestId: "site_asset_basis",
      currentWorkflowAction:
        "Create the primary site_asset_basis request before modeled human review; remaining evidence tasks stay available for follow-up routing.",
    },
    blockers: [
      {
        title: "Site evidence is incomplete",
        reason: "The file does not yet contain current site-level resilience evidence.",
      },
      {
        title: "External signal cannot clear the asset",
        reason: "External or screening-level signals can trigger review, but cannot support site clearance.",
      },
      {
        title: "Decision boundary must stay human-owned",
        reason: "The file prepares evidence and caveats; it does not make underwriting, pricing, engineering, or insurability decisions.",
      },
    ],
    evidenceTasks,
    handoffActions: buildReviewActions(caseData).map((action) => ({
      id: action.id,
      label: action.label,
      description: action.description,
    })),
    enterpriseControls,
    exceptionPath: [
      {
        id: "evidence_incomplete",
        condition: "Site-level resilience evidence remains missing.",
        nextStage: "create_evidence_request",
      },
      {
        id: "retry_wait",
        condition: "Evidence request remains open after SLA.",
        nextStage: "retry_or_wait_for_evidence",
      },
      {
        id: "escalate",
        condition: "Evidence still missing after retry.",
        nextStage: "escalate_missing_evidence",
      },
      {
        id: "manual_override",
        condition: "Reviewer keeps the case open with a caveat.",
        nextStage: "generate_caveated_decision_packet",
      },
    ],
    supportingDetails: [
      {
        id: "source-caveats",
        title: "Source caveats",
        items: workup.sourceSuitability.map((source) => `${source.name}: ${source.caveat}`),
      },
      {
        id: "hazard-translation",
        title: "Hazard translation",
        items: workup.hazardEvidenceInterpretation.map((row) => `${row.hazard}: ${row.evidenceRequest}`),
      },
      {
        id: "spatial-method",
        title: "Spatial method",
        items: workup.spatialTemporalContext.sourceDiagnostics.map(
          (row) => `${row.name}: ${row.spatialMethod}; ${row.caveat}`,
        ),
      },
    ],
  };
}

export function buildDecisionRecord(
  caseData,
  selectedActionId = "request_site_evidence",
  {
    selectedSourceIds = null,
    activeScenario = "multi-hazard",
    professionalWorkup = null,
    executionPlan = null,
  } = {},
) {
  const actions = buildReviewActions(caseData);
  const selectedAction = actions.find((action) => action.id === selectedActionId) ?? actions[0];
  const workup =
    professionalWorkup ??
    buildProfessionalWorkupPayload(caseData, { selectedSourceIds, activeScenario });
  const execution =
    executionPlan ??
    buildWorkupExecutionPlan(caseData, { selectedSourceIds: workup.selectedSourceIds, activeScenario });
  return {
    caseId: caseData.case_id,
    asset: caseData.asset.name,
    reviewType: caseData.review.type,
    activeScenario,
    selectedSourceIds: workup.selectedSourceIds,
    selectedActionId: selectedAction.id,
    nextAction: selectedAction.description,
    boundary: caseData.workup.boundary,
    humanReviewRequired: Boolean(caseData.review.human_reviewer_required),
    evidenceContext: {
      workupSummary: workup.summary,
      selectedSourceCount: workup.selectedSourceCount,
      createdEvidenceRequestCount: execution.createdEvidenceRequestCount,
      createdEvidenceRequestIds: execution.createdEvidenceRequestIds,
      requiredSections: workup.requiredSections,
      keyEvidenceGaps: workup.resilienceEvidenceGaps.map((gap) => gap.label),
      sourceCaveats: workup.sourceSuitability.map((source) => ({
        id: source.id,
        caveat: source.caveat,
        cannotSupport: source.cannotSupport,
      })),
      reviewQuestions: workup.reviewQuestions,
    },
    status: "Human-reviewed action captured",
    auditTrail: [
      "Case intake: portfolio physical-risk review created.",
      "Information check: selected material reviewed.",
      "Review prep: requests and supporting notes prepared.",
      `Review decision: reviewer selected ${selectedAction.id}.`,
      "Decision record: audit-ready packet stored for the portfolio file.",
    ],
  };
}

export function buildQueueItem(caseData, selectedSourceIds = null, activeScenario = "multi-hazard") {
  const sourceIds = selectedSourceIds ?? caseData.sources.map((source) => source.id);
  const enterpriseControls = buildEnterpriseControls();
  return {
    queueName: enterpriseControls.queueName,
    reference: caseData.case_id,
    priority: "Normal",
    specificContent: {
      queueReferenceId: caseData.case_id,
      workflowState: "case_intake_created",
      integrationMode: "queue_compatible_payload",
      liveQueueSubmitted: false,
      slaHours: enterpriseControls.slaHours,
      retryLimit: enterpriseControls.retryPolicy.maxAttempts,
      manualOverrideAllowed: enterpriseControls.manualOverrideAllowed,
      caseId: caseData.case_id,
      assetName: caseData.asset.name,
      assetType: caseData.asset.type,
      region: caseData.asset.region,
      reviewType: caseData.review.type,
      reviewMoment: caseData.review.moment,
      activeScenario,
      selectedSourceIds: sourceIds,
      sourceCount: sourceIds.length,
      humanReviewRequired: Boolean(caseData.review.human_reviewer_required),
    },
  };
}

export function buildHumanReviewTask(
  caseData,
  { selectedSourceIds = null, activeScenario = "multi-hazard", createdTaskIds = [] } = {},
) {
  const workup = buildProfessionalWorkupPayload(caseData, { selectedSourceIds, activeScenario });
  const execution = buildWorkupExecutionPlan(caseData, {
    selectedSourceIds: workup.selectedSourceIds,
    activeScenario,
    createdTaskIds,
  });
  return {
    taskTitle: `Review physical-risk work-up: ${caseData.asset.name}`,
    integrationMode: "human_task_model",
    productBoundary: "Modeled human review task; not a live Action Center task in this MVP package.",
    assignedRole: "Portfolio risk reviewer",
    dueStage: "Before renewal file closure",
    suggestedEvidenceOwner: "Asset owner / broker / risk engineering",
    inputRecord: {
      caseId: caseData.case_id,
      assetName: caseData.asset.name,
      reviewType: caseData.review.type,
      activeScenario,
      selectedSourceIds: workup.selectedSourceIds,
      workupSummary: workup.summary,
      createdEvidenceRequestCount: execution.createdEvidenceRequestCount,
      createdEvidenceRequestIds: execution.createdEvidenceRequestIds,
      missingEvidence: workup.resilienceEvidenceGaps,
      reviewQuestions: workup.reviewQuestions,
      sourceCaveats: workup.sourceSuitability.map((source) => ({
        id: source.id,
        caveat: source.caveat,
      })),
      boundary: caseData.workup.boundary,
    },
    options: buildReviewActions(caseData).map((action) => ({
      id: action.id,
      label: action.label,
      description: action.description,
      isDefault: action.isDefault,
    })),
    downstreamActionMap: {
      request_site_evidence: "Open evidence request for asset owner / broker.",
      refer_risk_engineering: "Create referral task for risk engineering review.",
      keep_under_review: "Keep case open with caveat and review date.",
    },
    outputFields: ["selectedActionId", "reviewerNote", "evidenceOwner"],
  };
}

export function buildWorkflowStages(
  caseData,
  { selectedSourceIds = null, activeScenario = "multi-hazard" } = {},
) {
  const workup = buildProfessionalWorkupPayload(caseData, { selectedSourceIds, activeScenario });
  return [
    {
      id: "case_intake",
      owner: "UiPath queue-compatible case payload",
      input: "Portfolio asset or renewal-review trigger.",
      output: `Queue item for ${caseData.case_id}.`,
    },
    {
      id: "confirm_evidence_readiness",
      owner: "Edgion information check",
      input: "Case id, asset context, selected source ids, and active hazard scenario.",
      output: `${workup.selectedSourceCount} selected sources with scale, horizon, intended use, and caveats.`,
    },
    {
      id: "run_specialist_workup",
      owner: "Edgion review prep",
      input: "Evidence package plus asset context.",
      output: "Review artifacts: source suitability, spatial / temporal context, resilience gaps, and reviewer questions.",
    },
    {
      id: "create_review_task",
      owner: "UiPath human task model",
      input: "Prepared review artifacts and safe boundary statement.",
      output: "Review task with evidence requests, review questions, allowed actions, and output fields.",
    },
    {
      id: "evidence_incomplete_retry_or_escalate",
      owner: "UiPath workflow controls",
      input: "Open evidence request status, SLA clock, retry count, and reviewer action.",
      output: "Retry, wait, escalate to portfolio risk lead, or proceed to a caveated decision packet.",
    },
    {
      id: "capture_reviewer_action",
      owner: "Reviewer",
      input: "Modeled human review task and prepared review artifacts.",
      output: "Selected action, reviewer note, and evidence owner.",
    },
    {
      id: "generate_decision_record",
      owner: "UiPath / Edgion record agent",
      input: "Reviewer action plus review package context.",
      output: "Audit-ready decision record and evidence trail for the portfolio file.",
    },
  ];
}

export function buildUiPathWorkflowPayload(
  caseData,
  {
    selectedSourceIds = null,
    activeScenario = "multi-hazard",
    selectedActionId = "request_site_evidence",
    createdTaskIds = [],
  } = {},
) {
  const sourceIds = selectedSourceIds ?? caseData.sources.map((source) => source.id);
  const professionalWorkup = buildProfessionalWorkupPayload(caseData, {
    selectedSourceIds: sourceIds,
    activeScenario,
  });
  const executionPlan = buildWorkupExecutionPlan(caseData, {
    selectedSourceIds: sourceIds,
    activeScenario,
    createdTaskIds,
  });
  const auditOutput = buildAuditOutput(caseData, selectedActionId, executionPlan.createdEvidenceRequestIds, {
    selectedSourceCount: professionalWorkup.selectedSourceCount,
    evidenceTaskCount: executionPlan.evidenceTasks.length,
  });
  return {
    workflowName: "Edgion_DataCentre_PhysicalRisk_Workup",
    stages: buildWorkflowStages(caseData, { selectedSourceIds: sourceIds, activeScenario }),
    queueItem: buildQueueItem(caseData, sourceIds, activeScenario),
    professionalWorkup,
    executionPlan,
    humanTask: buildHumanReviewTask(caseData, { selectedSourceIds: sourceIds, activeScenario, createdTaskIds }),
    decisionRecord: buildDecisionRecord(caseData, selectedActionId, {
      selectedSourceIds: sourceIds,
      activeScenario,
      professionalWorkup,
      executionPlan,
    }),
    auditOutput,
    outputArtifacts: ["queue_item_payload", "human_task_model", "decision_record_json", "audit_trail"],
  };
}

export function buildWorkflowSteps(
  activeView = "case",
  { workupRunning = false, workupRunStep = null, workupRunEvent = "idle", workupRunComplete = false } = {},
) {
  const order = ["case", "inputs", "workup", "review", "record"];
  const labels = {
    case: "Case signal",
    inputs: "Information check",
    workup: "Review prep",
    review: "Review decision",
    record: "Decision record",
  };
  const sidebarLabels = {
    case: "Case",
    inputs: "Evidence",
    workup: "Specialist",
    review: "Review",
    record: "Record",
  };
  const activeIndex = Math.max(order.indexOf(activeView), 0);
  return order.map((id, index) => {
    const status = workflowStepStatus(id, index, activeIndex, { activeView, workupRunning, workupRunComplete });
    const meta = workflowStepMeta(id, { workupRunning, workupRunStep, workupRunEvent, workupRunComplete });
    return {
      id,
      label: labels[id],
      sidebarLabel: sidebarLabels[id],
      status,
      displayStatus: meta.displayStatus ?? status,
      ...meta,
    };
  });
}

function workflowStepStatus(id, index, activeIndex, { activeView, workupRunning, workupRunComplete }) {
  if (id === "workup") {
    if (workupRunning) return "active";
    if (workupRunComplete && activeView === "workup") return "complete";
  }
  if (id === "review" && workupRunComplete && activeView === "workup") return "ready";
  return index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending";
}

function workflowStepMeta(id, { workupRunning, workupRunStep, workupRunEvent, workupRunComplete }) {
  if (id !== "workup") return {};
  if (workupRunning) {
    const specialistProgress = Math.max(1, Math.min(4, Number(workupRunStep) + 1 || 1));
    const pipelineState = buildSpecialistPipelineState({ workupRunning, workupRunStep, workupRunEvent, workupRunComplete });
    return {
      displayStatus: `preparing ${specialistProgress} / 4`,
      displayDetail: pipelineState.phase === "handoff" ? `Preparing ${pipelineState.toAgent}` : pipelineState.currentAgent,
      specialistProgress,
      specialistTotal: 4,
    };
  }
  if (workupRunComplete) {
    return {
      displayStatus: "complete",
      specialistProgress: 4,
      specialistTotal: 4,
    };
  }
  return {};
}

const specialistPipeline = [
  {
    agent: "Source Suitability Agent",
    artifact: "Source Suitability Matrix",
    focus: {
      "source-scale": "Checking source scale...",
      "source-limits": "Evaluating decision limits...",
      "source-matrix": "Building Source Suitability Matrix...",
    },
  },
  {
    agent: "Spatial Context Agent",
    artifact: "Spatial Context Note",
    focus: {
      "spatial-footprint": "Locating asset point...",
      "spatial-buffer": "Applying review buffer...",
      "spatial-context": "Linking nearby spatial context...",
      "spatial-caveats": "Recording confidence and caveats...",
    },
  },
  {
    agent: "Data-centre Resilience Agent",
    artifact: "Resilience Gap Board",
    focus: {
      "resilience-hazards": "Mapping hazard themes...",
      "resilience-dependencies": "Checking resilience dependencies...",
      "resilience-gaps": "Building resilience gap board...",
    },
  },
  {
    agent: "Workflow Handoff Agent",
    artifact: "Evidence Request Queue",
    focus: {
      "handoff-convert": "Converting findings into reviewer tasks...",
      "handoff-draft": "Drafting evidence request cards...",
      "handoff-ready": "Promoting requests for review...",
    },
  },
];

const handoffEvents = {
  "handoff-source-spatial": { fromIndex: 0, toIndex: 1 },
  "handoff-spatial-resilience": { fromIndex: 1, toIndex: 2 },
  "handoff-resilience-workflow": { fromIndex: 2, toIndex: 3 },
};

export function buildSpecialistPipelineTiming() {
  return {
    totalMs: 13200,
    handoffMs: 500,
    queueCadenceMs: 340,
    stages: {
      sourceSuitability: { startMs: 0, durationMs: 2200, handoffAtMs: 2300, nextAtMs: 2800 },
      spatialContext: { startMs: 2800, durationMs: 2300, handoffAtMs: 5200, nextAtMs: 5700 },
      dataCentreResilience: { startMs: 5700, durationMs: 3900, handoffAtMs: 9800, nextAtMs: 10300 },
      workflowHandoff: { startMs: 10300, durationMs: 2900 },
    },
  };
}

export function buildSpecialistWaitingState({
  workupRunning = false,
  workupRunStep = null,
  workupRunEvent = "idle",
  workupRunComplete = false,
} = {}) {
  const pipelineState = buildSpecialistPipelineState({ workupRunning, workupRunStep, workupRunEvent, workupRunComplete });
  const labels = ["Source Suitability", "Spatial Context", "Data-centre Resilience", "Workflow Handoff"];
  return labels.map((label, index) => {
    let state = "queued";
    if (workupRunComplete || index < Number(workupRunStep)) state = "complete";
    if (workupRunning && index === Number(workupRunStep)) state = "running";
    if (pipelineState.phase === "handoff") {
      if (index <= pipelineState.fromIndex) state = "complete";
      if (index === pipelineState.toIndex) state = "queued";
    }
    return { label, state };
  });
}

export function buildSpecialistPipelineState({
  workupRunning = false,
  workupRunStep = null,
  workupRunEvent = "idle",
  workupRunComplete = false,
} = {}) {
  if (workupRunComplete) {
    return {
      phase: "completed",
      currentAgent: null,
      currentFocus: "Review package ready",
    };
  }
  const handoff = handoffEvents[workupRunEvent];
  if (workupRunning && handoff) {
    return {
      phase: "handoff",
      fromIndex: handoff.fromIndex,
      toIndex: handoff.toIndex,
      fromArtifact: specialistPipeline[handoff.fromIndex].artifact,
      toAgent: specialistPipeline[handoff.toIndex].agent,
      currentFocus: "Passing material to the next step...",
    };
  }
  if (workupRunning) {
    const currentIndex = Math.max(0, Math.min(specialistPipeline.length - 1, Number(workupRunStep) || 0));
    const current = specialistPipeline[currentIndex];
    return {
      phase: "running",
      currentIndex,
      currentAgent: current.agent,
      currentArtifact: current.artifact,
      currentFocus: current.focus[workupRunEvent] ?? "Preparing review material...",
    };
  }
  return {
    phase: "idle",
    currentAgent: null,
    currentFocus: "Ready to prepare review package",
  };
}

export function buildOperatorGuide(activeView = "case", { runState = "queued" } = {}) {
  const guides = {
    case: {
      title: "Step 1",
      instruction: "Review the case signal, then confirm evidence readiness.",
      nextLabel: "Next: evidence readiness",
      nextView: "inputs",
    },
    inputs: {
      title: "Step 2",
      instruction: "Confirm the information for review.",
      description: "Check the selected information before continuing.",
      action: "none",
      nextLabel: "",
      nextView: "workup",
    },
    workup: buildWorkupOperatorGuide(runState),
    review: {
      title: "Step 4",
      instruction: "Review decision",
      description: "Review requests, resolve open questions, and choose what to record.",
      nextLabel: "Create decision record",
      nextView: "record",
    },
    record: {
      title: "Step 5",
      instruction: "Create decision record",
      description: "Save the evidence trail, reviewer action, caveats, and outcome.",
      nextLabel: "Back to case",
      nextView: "case",
    },
  };
  return guides[activeView] ?? guides.case;
}

function buildWorkupOperatorGuide(runState) {
  if (runState === "running") {
    return {
      title: "Step 3",
      instruction: "Preparing the review package",
      description:
        "Selected information is checked, gaps are listed, and requests are prepared for review.",
      nextLabel: "Preparing Review Package...",
      nextView: "workup",
      disabled: true,
      action: "run-workup",
    };
  }
  if (runState === "completed") {
    return {
      title: "Step 3",
      instruction: "Review package ready",
      description: "Requests are ready for reviewer action.",
      nextLabel: "Continue to Review",
      nextView: "review",
    };
  }
  return {
    title: "Step 3",
    instruction: "Prepare the review package",
    description:
      "Selected information is checked, gaps are listed, and requests are prepared for review.",
    nextLabel: "Prepare Review Package",
    nextView: "workup",
    action: "run-workup",
  };
}

function sourceSpatialMethod(source) {
  if (source.id === "screening_level_spatial_hazard_context") {
    return {
      spatialMethod: "point / buffer overlay",
      reviewUse: "screening-level local context and reviewer questions",
      confidence: "medium for triage, low for site clearance",
      caveat: "Native scale and asset-location confidence must be recorded before any human conclusion.",
    };
  }
  if (source.id === "external_physical_risk_signal") {
    return {
      spatialMethod: "scale caveat review",
      reviewUse: "portfolio trigger and asset-class context",
      confidence: "low for site-level use",
      caveat: "Market or regional signal cannot clear or fail a single site.",
    };
  }
  if (source.id === "site_resilience_notes") {
    return {
      spatialMethod: "site evidence gap extraction",
      reviewUse: "asset-specific resilience questions",
      confidence: "medium for gap identification",
      caveat: "Missing records do not prove missing controls.",
    };
  }
  if (source.id === "operational_continuity_context") {
    return {
      spatialMethod: "dependency context mapping",
      reviewUse: "power, cooling, water, access, and BI relevance",
      confidence: "medium for review scoping",
      caveat: "Operational context is not verified site performance.",
    };
  }
  return {
    spatialMethod: "assumption context review",
    reviewUse: "business context and assumption to test",
    confidence: "context only",
    caveat: "Internal record is not independent spatial evidence.",
  };
}

export function buildSpatialWorkup(caseData, selectedSourceIds = null) {
  const selectedIds = new Set(selectedSourceIds ?? caseData.sources.map((source) => source.id));
  const selectedSources = caseData.sources.filter((source) => selectedIds.has(source.id));
  return {
    assetGeometry: {
      asset: caseData.asset.name,
      region: caseData.asset.region,
      type: "synthetic point",
      workingGeometry: "point plus review buffer",
      locationConfidence: "demo coordinate; not a real site assessment",
    },
    operations: [
      "Represent the asset as a review geometry and record location confidence.",
      "Classify every source by native spatial scale and intended use.",
      "Choose the appropriate spatial operation: point-in-polygon, buffer overlay, nearest grid cell, or scale caveat review.",
      "Turn spatial findings into reviewer questions and caveats instead of a site-level risk conclusion.",
    ],
    sourceDiagnostics: selectedSources.map((source) => ({
      id: source.id,
      name: source.name,
      nativeScale: source.granularity ?? "unknown",
      horizon: source.time_horizon ?? "unknown",
      ...sourceSpatialMethod(source),
    })),
    professionalBoundary:
      "This is a geospatial review note, not a GIS-certified site assessment or engineering conclusion.",
  };
}
