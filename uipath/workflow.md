# UiPath Workflow Handoff

## Demo Position

This MVP uses UiPath as the workflow and orchestration layer. Edgion prepares the specialist work-up that sits between scattered physical-risk information and the human review task.

The demo should not claim that the workflow prices, underwrites, certifies, clears, or rejects a data-centre asset.

Core demo line: UiPath owns the governed case workflow; Edgion agents provide the specialist work-up; the human reviewer owns the business decision.

## Workflow Shape

| Stage | Owner | Input | Output |
| --- | --- | --- | --- |
| `case_intake` | UiPath queue-compatible case payload | Portfolio asset or renewal-review trigger. | Queue-compatible case payload for the case. |
| `load_source_pack` | Edgion source agent | Case id, asset context, selected source ids, and active hazard scenario. | Selected sources with scale, horizon, intended use, and caveats. |
| `run_agent_workup` | Edgion specialist agents | Selected source pack plus asset context. | Professional work-up: source suitability, spatial / temporal context, resilience gaps, and reviewer questions. |
| `create_evidence_request_sla` | UiPath workflow controls | Evidence gaps, owner, SLA clock, and retry policy. | Evidence request with 48-hour SLA, retry limit, and escalation owner. |
| `apply_sla_retry_controls` | UiPath workflow controls | Open evidence request status, SLA clock, retry count, and reviewer action. | Wait, retry, escalate to portfolio risk lead, or proceed to human review. |
| `model_human_review_task` | UiPath human task model | Professional work-up payload and safe boundary statement. | Modeled human review task with evidence gaps, review questions, allowed actions, and output fields. |
| `capture_human_action` | Human reviewer | Modeled human review task and professional work-up. | Selected action, reviewer note, evidence owner, and manual override flag. |
| `generate_audit_decision_packet` | UiPath / Edgion record agent | Human action plus professional work-up evidence context. | Audit-ready decision packet and evidence trail for the portfolio file. |

## Queue-Compatible Case Payload

This MVP exports a Queue-compatible case payload for UiPath handoff. In local review mode, it is not claiming that a live Orchestrator Queue transaction has already been created. The optional adapter can submit the same shape to Orchestrator when credentials are configured.

Queue name:

```text
DataCentrePhysicalRiskReview
```

Reference:

```text
TVDC01-2026-REVIEW
```

Specific content fields:

| Field | Meaning |
| --- | --- |
| `caseId` | Internal case identifier. |
| `assetName` | Asset displayed to the reviewer. |
| `assetType` | Data centre for the demo case. |
| `region` | Working regional context. |
| `reviewType` | Portfolio physical-risk review. |
| `reviewMoment` | Why this is being reviewed now. |
| `activeScenario` | Current hazard lens shown in the demo. |
| `selectedSourceIds` | Source inputs included in the agent work-up. |
| `sourceCount` | Number of selected sources. |
| `humanReviewRequired` | Always true in this MVP path. |
| `integrationMode` | `queue_compatible_payload` in local mode. |
| `liveQueueSubmitted` | `false` unless the optional Orchestrator adapter is configured and used. |
| `slaHours` | Evidence request SLA, currently 48 hours. |
| `retryLimit` | Maximum modeled retry attempts before escalation. |
| `manualOverrideAllowed` | Whether a reviewer can override the default path. |

## Professional Work-Up Payload

This is the core Edgion value in the workflow. It should not be reduced to a note field.

Main fields:

| Field | Meaning |
| --- | --- |
| `summary` | One-line explanation of the agent-prepared specialist material. |
| `requiredSections` | The sections the reviewer should be able to see. |
| `sourceSuitability` | Per-source scale, horizon, useful use, unsupported use, hazards, and caveat. |
| `spatialTemporalContext` | Asset geometry, location confidence, spatial operation, source diagnostics, and professional boundary. |
| `hazardEvidenceInterpretation` | How each hazard theme is translated into evidence requests and review boundaries. |
| `resilienceEvidenceGaps` | The site-level evidence still needed before closure. |
| `reviewQuestions` | Questions the human reviewer should answer or route. |
| `professionalBoundary` | The explicit boundary of what this work-up does not conclude. |

The work-up is the part that shows Edgion is not only routing a task. The agents prepare specialist material before the human reviewer acts.

## Execution Plan

The reviewer should not have to read the professional work-up as a report. The workflow turns it into an execution plan:

| Field | Meaning |
| --- | --- |
| `status` | Whether the case can proceed automatically or needs human review. |
| `primaryNextStep` | The next action the workflow recommends creating. |
| `blockers` | Why the case cannot close automatically. |
| `evidenceTasks` | Concrete evidence requests with owner, request text, and status. |
| `createdEvidenceRequestCount` | Number of evidence requests already created in the prototype flow. |
| `createdEvidenceRequestIds` | Evidence request ids created before the human review step. |
| `evidenceRequestPolicy` | Explains that six evidence tasks are identified and this workflow creates the primary `site_asset_basis` request before human review. |
| `handoffActions` | Allowed human review actions. |
| `supportingDetails` | Optional source caveats, hazard translation, and spatial method details. |

The UI should show the execution plan first. The professional work-up should be supporting detail, not the main user experience.

## Human Review Task Model

Task title:

```text
Review physical-risk work-up: Thames Valley DC-01
```

Assigned role:

```text
Portfolio risk reviewer
```

Due stage:

```text
Before renewal file closure
```

Human output fields:

| Field | Meaning |
| --- | --- |
| `selectedActionId` | The reviewer-selected action. |
| `reviewerNote` | Optional human note for the file. |
| `evidenceOwner` | The person or team expected to provide missing evidence. |
| `manualOverrideRequested` | Whether the reviewer invoked an override path. |

Task input should include:

- work-up summary
- created evidence request count and ids
- missing evidence list
- review questions
- selected source ids
- source caveats
- safe professional boundary

Available actions:

| Action ID | Label | Use |
| --- | --- | --- |
| `request_site_evidence` | Request site-level evidence | Default action when the site evidence file is incomplete. |
| `refer_risk_engineering` | Refer to risk engineering | Use when decision-grade engineering review is required. |
| `keep_under_review` | Keep under review with caveat | Use when the asset remains open pending later evidence or committee review. |

This is a modeled human task in the MVP package. The workflow does not claim that a live Action Center task is already connected.

## Edgion Work-Up Boundary

Edgion prepares:

- source suitability checks
- spatial and temporal context
- source caveats and native-scale limits
- data-centre resilience evidence gaps
- reviewer questions
- traceable decision-record material

Edgion does not output:

- site-level clearance
- underwriting decision
- pricing decision
- insurability decision
- valuation conclusion
- Tier, ASHRAE, FM, TIA-942, EN 50600, or insurer-standard certification
- BI, MFL, PML, or engineering conclusion

## Sample Payload

Machine-readable sample:

```text
sample_payload.json
```

The browser prototype also exports this same workflow payload from the Record page.

The payload contains:

- `queueItem`
- `professionalWorkup`
- `executionPlan`
- `humanTask`
- `decisionRecord`
- `auditOutput`
- `outputArtifacts`

`executionPlan.createdEvidenceRequestCount` and `executionPlan.createdEvidenceRequestIds` are carried into both `humanTask.inputRecord` and `decisionRecord.evidenceContext`. This is the key state handoff that proves the demo is executing a workflow, not only displaying a static work-up.

For the final sample payload, `site_asset_basis` is already created:

```text
createdEvidenceRequestCount = 1
createdEvidenceRequestIds = ["site_asset_basis"]
```

The audit packet also carries:

- `stageStatus`: queue intake, source pack, specialist work-up, evidence request, human action, and decision packet status.
- `eventHistory`: queue created, source pack loaded, work-up completed, evidence request created, human action captured, and packet generated.

## Frontend And UiPath Boundary

The Edgion browser prototype is the specialist workbench:

- map context
- source pack
- geo-specialist workbench
- professional work-up
- decision record preview

UiPath should demonstrate:

- queue intake
- task routing
- modeled human handoff
- SLA retry / escalation controls
- status progression
- audit packet and output artifact generation

This keeps the demo credible: the product value is specialist work-up preparation, while UiPath provides enterprise process control.

## Recording Path

1. Start at the Case view and show the data-centre asset.
2. Switch one hazard scenario to show the case context changes.
3. Go to Inputs and keep the source pack visible.
4. Go to Work-up and create at least one evidence request from the queue.
5. Go to Human Review and show that the `site_asset_basis` request status is carried into the modeled human task.
6. Choose one human action.
7. Go to Record and show the generated workflow payload with the same created evidence request state, `stageStatus`, and `eventHistory`.
