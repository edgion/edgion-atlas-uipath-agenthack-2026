import {
  buildQueueItem,
  buildUiPathWorkflowPayload,
} from "./core.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultIdGenerator() {
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function withWorkflowRun(queueItem, workflowRunId) {
  return {
    ...queueItem,
    specificContent: {
      ...queueItem.specificContent,
      workflowRunId,
    },
  };
}

function buildBridgePayload(caseRecord, payload) {
  return {
    queueItem: withWorkflowRun(payload.queueItem, caseRecord.workflowRunId),
    reference: caseRecord.caseData.case_id,
    specificContent: {
      workflowRunId: caseRecord.workflowRunId,
      caseId: caseRecord.caseData.case_id,
      activeScenario: caseRecord.activeScenario,
      selectedSourceIds: caseRecord.selectedSourceIds,
      createdEvidenceRequestIds: Array.from(caseRecord.createdTaskIds),
      selectedActionId: caseRecord.humanAction?.selectedActionId ?? "request_site_evidence",
      reviewerNote: caseRecord.humanAction?.reviewerNote ?? "",
      evidenceOwner: caseRecord.humanAction?.evidenceOwner ?? "",
      professionalWorkup: payload.professionalWorkup,
      executionPlan: payload.executionPlan,
      humanTask: payload.humanTask,
      decisionRecord: payload.decisionRecord,
    },
  };
}

function buildPayload(caseRecord) {
  return buildUiPathWorkflowPayload(caseRecord.caseData, {
    selectedSourceIds: caseRecord.selectedSourceIds,
    activeScenario: caseRecord.activeScenario,
    selectedActionId: caseRecord.humanAction?.selectedActionId ?? "request_site_evidence",
    createdTaskIds: Array.from(caseRecord.createdTaskIds),
  });
}

function transitionRuntime(caseRecord, currentStage) {
  const payload = buildPayload(caseRecord);
  return {
    workflowRunId: caseRecord.workflowRunId,
    currentStage,
    stages: payload.stages,
    state: {
      caseId: caseRecord.caseData.case_id,
      status: caseRecord.status,
      activeScenario: caseRecord.activeScenario,
      selectedSourceCount: caseRecord.selectedSourceIds.length,
      createdEvidenceRequestCount: caseRecord.createdTaskIds.size,
      selectedActionId: caseRecord.humanAction?.selectedActionId ?? "request_site_evidence",
    },
  };
}

function pushHistory(caseRecord, event, detail = {}, now) {
  caseRecord.history.push({
    event,
    detail,
    index: caseRecord.history.length + 1,
    at: now(),
  });
}

export function createWorkflowBackend({
  idGenerator = defaultIdGenerator,
  now = () => new Date().toISOString(),
} = {}) {
  const cases = new Map();

  function requireCase(caseId) {
    const caseRecord = cases.get(caseId);
    if (!caseRecord) throw new Error(`Unknown case: ${caseId}`);
    return caseRecord;
  }

  return {
    createCase(caseData, { selectedSourceIds = null, activeScenario = "multi-hazard" } = {}) {
      const sourceIds = selectedSourceIds ?? caseData.sources.map((source) => source.id);
      const workflowRunId = idGenerator();
      const caseRecord = {
        caseData: clone(caseData),
        workflowRunId,
        selectedSourceIds: [...sourceIds],
        activeScenario,
        createdTaskIds: new Set(),
        humanAction: null,
        status: "case_created",
        history: [],
      };
      cases.set(caseData.case_id, caseRecord);
      pushHistory(caseRecord, "case_created", {
        selectedSourceCount: sourceIds.length,
        activeScenario,
      }, now);
      return {
        caseId: caseData.case_id,
        workflowRunId,
        status: caseRecord.status,
        bridgeStage: "case_intake",
        queueItem: withWorkflowRun(buildQueueItem(caseRecord.caseData, sourceIds, activeScenario), workflowRunId),
        runtime: transitionRuntime(caseRecord, "case_intake"),
      };
    },

    runWorkup(caseId) {
      const caseRecord = requireCase(caseId);
      const payload = buildPayload(caseRecord);
      caseRecord.status = "workup_prepared";
      pushHistory(caseRecord, "workup_prepared", {
        selectedSourceCount: payload.professionalWorkup.selectedSourceCount,
        evidenceTaskCount: payload.executionPlan.evidenceTasks.length,
      }, now);
      return {
        caseId,
        workflowRunId: caseRecord.workflowRunId,
        status: caseRecord.status,
        bridgeStage: "run_specialist_workup",
        professionalWorkup: payload.professionalWorkup,
        executionPlan: payload.executionPlan,
        runtime: transitionRuntime(caseRecord, "run_specialist_workup"),
      };
    },

    createEvidenceRequest(caseId, taskId) {
      const caseRecord = requireCase(caseId);
      const available = buildPayload(caseRecord).executionPlan.evidenceTasks;
      if (!available.some((task) => task.id === taskId)) throw new Error(`Unknown evidence task: ${taskId}`);
      caseRecord.createdTaskIds.add(taskId);
      caseRecord.status = "evidence_request_created";
      pushHistory(caseRecord, "evidence_request_created", { taskId }, now);
      return {
        caseId,
        workflowRunId: caseRecord.workflowRunId,
        taskId,
        status: caseRecord.status,
        bridgeStage: "create_review_task",
        createdEvidenceRequestIds: Array.from(caseRecord.createdTaskIds),
        runtime: transitionRuntime(caseRecord, "create_review_task"),
      };
    },

    captureHumanAction(caseId, { selectedActionId, reviewerNote = "", evidenceOwner = "" }) {
      const caseRecord = requireCase(caseId);
      caseRecord.humanAction = {
        selectedActionId,
        reviewerNote,
        evidenceOwner,
      };
      caseRecord.status = "human_action_captured";
      pushHistory(caseRecord, "human_action_captured", caseRecord.humanAction, now);
      return {
        caseId,
        workflowRunId: caseRecord.workflowRunId,
        status: caseRecord.status,
        bridgeStage: "capture_reviewer_action",
        ...caseRecord.humanAction,
        runtime: transitionRuntime(caseRecord, "capture_reviewer_action"),
      };
    },

    getFinalPayload(caseId) {
      const caseRecord = requireCase(caseId);
      const payload = buildPayload(caseRecord);
      caseRecord.status = "decision_record_ready";
      pushHistory(caseRecord, "final_payload_generated", {
        selectedActionId: payload.decisionRecord.selectedActionId,
        createdEvidenceRequestCount: payload.executionPlan.createdEvidenceRequestCount,
      }, now);
      const runtime = transitionRuntime(caseRecord, "generate_decision_record");
      return {
        ...payload,
        workflowRunId: caseRecord.workflowRunId,
        runtime,
        uipathBridgePayload: buildBridgePayload(caseRecord, payload),
        backendState: {
          status: caseRecord.status,
          humanAction: caseRecord.humanAction ? { ...caseRecord.humanAction } : null,
          history: clone(caseRecord.history),
        },
      };
    },

    getCase(caseId) {
      const caseRecord = requireCase(caseId);
      return {
        caseId,
        workflowRunId: caseRecord.workflowRunId,
        status: caseRecord.status,
        selectedSourceIds: [...caseRecord.selectedSourceIds],
        activeScenario: caseRecord.activeScenario,
        createdEvidenceRequestIds: Array.from(caseRecord.createdTaskIds),
        humanAction: caseRecord.humanAction ? { ...caseRecord.humanAction } : null,
        history: clone(caseRecord.history),
      };
    },
  };
}
