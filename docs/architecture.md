# Architecture

## One-Line Architecture

Edgion Atlas uses a browser specialist workbench for review preparation and UiPath Maestro BPMN for enterprise case orchestration.

UiPath owns the governed case workflow; Edgion agents provide the specialist work-up; the human reviewer owns the business decision.

```text
Portfolio case signal
-> Browser specialist workbench
-> Local workflow bridge
-> Queue-compatible workflow payload
-> UiPath Maestro BPMN orchestration proof
-> Modeled human review task
-> Audit decision packet
```

## Browser Workbench

The browser prototype is the product surface. It shows:

- the data-centre case context;
- the selected source pack;
- source suitability and caveats;
- specialist work-up preparation;
- evidence request generation;
- human review action selection;
- decision-record output.

The workbench is intentionally not an underwriting screen. It prepares review-ready material for a reviewer.

## Local Workflow Bridge

The local Node bridge turns browser actions into workflow state:

```text
POST /api/workflow/cases
POST /api/workflow/cases/:caseId/workup
POST /api/workflow/cases/:caseId/evidence-requests
POST /api/workflow/cases/:caseId/human-action
GET  /api/workflow/cases/:caseId/final-payload
POST /api/workflow/cases/:caseId/uipath-submit
```

The bridge produces:

- workflow run id;
- event history;
- selected sources;
- created evidence request ids;
- selected human action;
- queue reference fields for `DataCentrePhysicalRiskReview`;
- SLA / retry / escalation controls for missing evidence;
- modeled human review task input and output fields;
- audit-ready decision packet;
- stage status and event history for the audit packet;
- final Queue-compatible payload.

In local review mode, the bridge produces a Queue-compatible case payload. It is not a live Orchestrator Queue transaction unless the optional adapter is configured with UiPath credentials.

## UiPath Automation Cloud

The UiPath side demonstrates orchestration:

```text
Start
-> Create Queue Item: Risk Review
-> Load Edgion Source Pack
-> Run Specialist Work-up
-> Work-up + Evidence Ready?
   -> no: Evidence Missing: Retry / Escalate -> Retry / Escalate End
   -> yes: Create Evidence Request + SLA
-> Apply SLA / Retry Controls
-> Model Human Review Task
-> Capture Action + Override
-> Action / Override?
-> Join Actions
-> Generate Audit Decision Packet
-> Audit Packet End
```

For the hackathon build, the UiPath BPMN process is self-contained and uses script-task payloads. It was debugged successfully and published as `Solution ver. 1.0.1`. The workflow now visibly carries queue-compatible payload fields, SLA / retry / escalation controls, a modeled human task, manual override metadata, and an audit decision packet with stage status and event history. These would be bound to live UiPath Queue / Action Center / storage services in a production build.

## Production Integration Path

The production version would replace mock payloads with:

- live queue intake;
- source-pack retrieval;
- specialist agent job execution;
- Action Center or Action App human task;
- persistent decision-record storage;
- audit log export.

## Why This Boundary Is Deliberate

The browser workbench carries the domain-specific review experience. UiPath carries governance, orchestration, handoff, and traceability. Keeping these roles separate makes the demo credible and avoids claiming that the product replaces underwriting or engineering judgment.
