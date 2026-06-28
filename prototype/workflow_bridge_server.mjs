import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createWorkflowBackend } from "./workflow_backend.mjs";
import { createUiPathAdapter } from "./uipath_adapter.mjs";
import { caseData } from "./data.mjs";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".geojson", "application/geo+json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
]);

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body, null, 2));
}

function sendError(response, status, error) {
  sendJson(response, status, {
    ok: false,
    error: error?.message ?? String(error),
  });
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  return JSON.parse(text);
}

function safeStaticPath(pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const decoded = decodeURIComponent(requested.split("?")[0]);
  const fullPath = normalize(join(rootDir, decoded));
  if (relative(rootDir, fullPath).startsWith("..")) return null;
  return fullPath;
}

function serveStatic(request, response) {
  const url = new URL(request.url, "http://127.0.0.1");
  const filePath = safeStaticPath(url.pathname);
  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "content-type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

function routeMatch(pathname, pattern) {
  const pathParts = pathname.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;
  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index];
    const pathPart = pathParts[index];
    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      return null;
    }
  }
  return params;
}

export function createBridgeServer({
  idGenerator,
  now,
  uipathEnv = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const backend = createWorkflowBackend({ idGenerator, now });
  const uipath = createUiPathAdapter({ env: uipathEnv, fetchImpl });

  async function handleApi(request, response) {
    const url = new URL(request.url, "http://127.0.0.1");
    const pathname = url.pathname;
    try {
      if (request.method === "GET" && pathname === "/api/health") {
        sendJson(response, 200, { ok: true, uipath: uipath.describe() });
        return;
      }

      if (request.method === "POST" && pathname === "/api/workflow/cases") {
        const body = await readJsonBody(request);
        const result = backend.createCase(caseData, {
          selectedSourceIds: body.selectedSourceIds,
          activeScenario: body.activeScenario,
        });
        sendJson(response, 201, result);
        return;
      }

      const workupParams = routeMatch(pathname, "/api/workflow/cases/:caseId/workup");
      if (request.method === "POST" && workupParams) {
        sendJson(response, 200, backend.runWorkup(workupParams.caseId));
        return;
      }

      const requestParams = routeMatch(pathname, "/api/workflow/cases/:caseId/evidence-requests");
      if (request.method === "POST" && requestParams) {
        const body = await readJsonBody(request);
        sendJson(response, 200, backend.createEvidenceRequest(requestParams.caseId, body.taskId));
        return;
      }

      const actionParams = routeMatch(pathname, "/api/workflow/cases/:caseId/human-action");
      if (request.method === "POST" && actionParams) {
        const body = await readJsonBody(request);
        sendJson(response, 200, backend.captureHumanAction(actionParams.caseId, body));
        return;
      }

      const caseParams = routeMatch(pathname, "/api/workflow/cases/:caseId");
      if (request.method === "GET" && caseParams) {
        sendJson(response, 200, backend.getCase(caseParams.caseId));
        return;
      }

      const finalParams = routeMatch(pathname, "/api/workflow/cases/:caseId/final-payload");
      if (request.method === "GET" && finalParams) {
        sendJson(response, 200, backend.getFinalPayload(finalParams.caseId));
        return;
      }

      const submitParams = routeMatch(pathname, "/api/workflow/cases/:caseId/uipath-submit");
      if (request.method === "POST" && submitParams) {
        const finalPayload = backend.getFinalPayload(submitParams.caseId);
        const result = await uipath.submitWorkflowPayload(finalPayload.uipathBridgePayload);
        sendJson(response, 200, {
          ok: true,
          caseId: submitParams.caseId,
          workflowRunId: finalPayload.workflowRunId,
          uipath: result,
          payload: finalPayload.uipathBridgePayload,
        });
        return;
      }

      sendError(response, 404, new Error(`Unknown API route: ${request.method} ${pathname}`));
    } catch (error) {
      sendError(response, error?.message?.startsWith("Unknown") ? 404 : 400, error);
    }
  }

  const server = createServer((request, response) => {
    if (request.url?.startsWith("/api/")) {
      handleApi(request, response);
      return;
    }
    if (request.method !== "GET") {
      sendError(response, 405, new Error("Only GET is supported for static files."));
      return;
    }
    serveStatic(request, response);
  });

  return {
    server,
    backend,
    uipath,
    listen(port = Number(process.env.PORT || 8767), host = "127.0.0.1") {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          const address = server.address();
          resolve({
            server,
            backend,
            uipath,
            url: `http://${host}:${address.port}`,
          });
        });
      });
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const bridge = createBridgeServer();
  const { url } = await bridge.listen();
  console.log(`Workflow bridge server running at ${url}`);
}
