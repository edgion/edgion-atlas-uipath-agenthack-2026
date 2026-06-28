# UiPath Maestro Build Status

Date: 2026-06-28

This file keeps the original path used by the submission checklist, but the status below reflects the post-review enterprise workflow patch.

Core demo line: UiPath owns the governed case workflow; Edgion agents provide the specialist work-up; the human reviewer owns the business decision.

## Current UiPath Project

- Tenant / workspace: UiPath Automation Cloud hackathon tenant
- Studio project: `Maestro BPMN`
- Studio URL: omitted from the public package; screenshots and the BPMN export
  are included as submission evidence.
- Published package: `Solution ver. 1.0.1`
- Published location shown by Studio: `Orchestrator Tenant (DefaultTenant)`
- Local BPMN export: `process.bpmn`

## What Was Built

The UiPath workflow now represents the Edgion AgentHack MVP as a BPMN process with explicit enterprise controls:

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
   -> Waiting for Site Evidence
   -> Referred to Risk Engineering
   -> Proceed with Caveats
-> Join Actions
-> Generate Audit Decision Packet
-> Audit Packet End
```

The case used in the workflow is the same case used by the browser MVP:

```text
caseRef = "TVDC01-2026-REVIEW"
queueName = "DataCentrePhysicalRiskReview"
asset = "Thames Valley DC-01"
selectedActionId = "request_site_evidence"
```

## Verification Evidence

Fresh Studio Web verification was run on 2026-06-28.

Observed debug result:

```text
Preparing projects for debugging completed
Provisioning solution completed
Execution status changed to Running
Execution status changed to Succeeded
Output: Successful
```

Studio generated a debug instance:

```text
Instance id retained in the private hackathon tenant; omitted from the public package.
```

The process was then published as:

```text
Published v1.0.1
Package name: Solution ver. 1.0.1
Publish status: Successful
```

Release notes used for the package:

```text
Enterprise workflow patch: queue item payload for DataCentrePhysicalRiskReview, modeled human review task boundary, SLA retry/escalation controls, manual override path, and audit decision packet output. Debug run succeeded after patch.
```

## Important Scope Choice

The UiPath process is self-contained and uses script-task payloads for hackathon reliability.

This is deliberate:

- It keeps the workflow executable in Studio Web.
- It shows Queue-compatible payload fields, SLA / retry / escalation controls, a modeled human review task, manual override metadata, and audit packet output.
- The matching local payload sample now carries `site_asset_basis` as the created primary evidence request plus `stageStatus` and `eventHistory` in the audit packet.
- It does not claim a live Action Center task, live source connector, underwriting/pricing decision, or site-clearance decision.

For a production version, the script tasks should be swapped for:

- live queue intake;
- source-pack retrieval;
- specialist agent job execution;
- live Action Center or Action App human task;
- persistent decision-record storage.

## How To Use This In The Video

The UiPath segment should show three things:

1. The BPMN canvas:
   The process is not just a static report. It is an orchestrated case workflow with queue intake, retry / escalation, human review model, and audit packet generation.

2. The debug run:
   Show `Execution status changed to Succeeded` and `Output: Successful`.

3. The published package:
   Show `Published v1.0.1` / `Solution ver. 1.0.1` to prove the workflow was packaged, not only drawn.

The browser MVP should still carry the richer product story:

```text
map / hazard context -> source suitability -> specialist work-up -> evidence request -> human review -> decision record
```

UiPath's job in the story is orchestration, queue-compatible case intake, human handoff governance, retry / escalation control, traceability, and repeatable case execution.

## Current Build Status

```text
UiPath BPMN canvas: enterprise patch applied
Studio debug run: succeeded on 2026-06-28
Published package: v1.0.1 created successfully
Browser MVP: local bridge and payload updated with matching queue / retry / audit fields
Remaining work: update final recording / Devpost packaging if the published version number is shown
```
