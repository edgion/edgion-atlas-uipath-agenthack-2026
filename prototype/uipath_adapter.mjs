function trimSlash(value) {
  return String(value ?? "").replace(/\/+$/, "");
}

function readConfig(env = process.env) {
  const orchestratorUrl = trimSlash(env.UIPATH_ORCHESTRATOR_URL);
  const accessToken = env.UIPATH_ACCESS_TOKEN ?? "";
  const folderId = env.UIPATH_FOLDER_ID ?? env.UIPATH_ORGANIZATION_UNIT_ID ?? "";
  const queueName = env.UIPATH_QUEUE_NAME ?? "DataCentrePhysicalRiskReview";
  return {
    orchestratorUrl,
    accessToken,
    folderId,
    queueName,
    configured: Boolean(orchestratorUrl && accessToken),
  };
}

function buildQueueBody(payload, queueName) {
  const queueItem = payload.queueItem ?? payload.uipathBridgePayload?.queueItem;
  const specificContent = payload.specificContent ?? queueItem?.specificContent ?? {};
  return {
    itemData: {
      Name: queueName ?? queueItem?.queueName ?? "DataCentrePhysicalRiskReview",
      Priority: queueItem?.priority ?? "Normal",
      Reference: queueItem?.reference ?? specificContent.caseId,
      SpecificContent: specificContent,
    },
  };
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function createUiPathAdapter({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const config = readConfig(env);

  return {
    describe() {
      return {
        mode: config.configured ? "uipath" : "local",
        configured: config.configured,
        queueName: config.queueName,
        orchestratorUrl: config.orchestratorUrl || null,
        requires: ["UIPATH_ORCHESTRATOR_URL", "UIPATH_ACCESS_TOKEN", "UIPATH_FOLDER_ID"],
      };
    },

    async submitWorkflowPayload(payload) {
      if (!config.configured) {
        return {
          mode: "local",
          configured: false,
          submitted: false,
          reason: "UIPATH_ORCHESTRATOR_URL or UIPATH_ACCESS_TOKEN is not configured",
          queuePreview: buildQueueBody(payload, config.queueName),
        };
      }
      if (!fetchImpl) throw new Error("No fetch implementation available for UiPath adapter.");

      const endpoint = `${config.orchestratorUrl}/odata/Queues/UiPathODataSvc.AddQueueItem`;
      const headers = {
        authorization: `Bearer ${config.accessToken}`,
        accept: "application/json",
        "content-type": "application/json",
      };
      if (config.folderId) headers["x-uipath-organizationunitid"] = config.folderId;

      const body = buildQueueBody(payload, config.queueName);
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const responseBody = await parseJsonResponse(response);
      return {
        mode: "uipath",
        configured: true,
        submitted: response.ok,
        httpStatus: response.status,
        endpoint,
        queueName: config.queueName,
        response: responseBody,
      };
    },
  };
}
