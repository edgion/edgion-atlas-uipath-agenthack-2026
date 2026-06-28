# Demo Video Script Outline

Target length: 3:30 to 4:30. Hard limit: 5:00.

## 1. Problem, 25 seconds

A data-centre portfolio review gets a physical-risk signal. The problem is not that one more map is missing. The reviewer has hazard layers, market signals, site notes, resilience information, and internal assumptions, but no clean way to turn them into a review file a human can defend.

Edgion Atlas uses specialist agents to prepare that work-up, and UiPath to control the human-in-the-loop case path.

Core line:

```text
UiPath owns the governed case workflow; Edgion agents provide the specialist work-up; the human reviewer owns the business decision.
```

## 2. Product Workbench, 90 seconds

Show the browser prototype:

1. Case page: Thames Valley DC-01 enters review.
2. Hazard context: the asset has physical-risk signals and incomplete site-level resilience information.
3. Inputs page: the source pack explains source scale, horizon, useful use, and limits.
4. Work-up page: agents prepare the review package and evidence requests.
5. Human review page: the reviewer chooses the business action.
6. Record page: the decision record carries evidence context, limitations, selected action, and audit trail.

Key line:

```text
The product does not decide for the reviewer. It prepares the material so the review is faster, cleaner, and easier to trace.
```

## 3. UiPath Workflow, 60 to 80 seconds

Show:

- UiPath Maestro BPMN canvas.
- The same case reference: `TVDC01-2026-REVIEW`.
- Debug run succeeded.
- Published package v1.0.1.

Key line:

```text
UiPath provides the workflow control: queue intake, specialist work-up, evidence request with SLA controls, retry or escalation, modeled human handoff, action capture, and audit decision packet.
```

Show that the payload carries `site_asset_basis` as the created primary evidence request, plus `stageStatus` and `eventHistory` in the audit packet.

## 4. Architecture, 35 seconds

Explain the split:

```text
Browser workbench = specialist review experience.
Local bridge = workflow state and payload.
UiPath Maestro = orchestration proof.
Human reviewer = final decision owner.
```

Mention the boundary clearly:

```text
The local package models the human review task and Queue-compatible payload. It does not claim live Queue submission or a live Action Center task. A production version would bind this to live Queue and Action Center services.
```

## 5. Close, 20 seconds

Close with:

```text
The strongest agent here is not the one that pretends to clear the asset. It is the one that knows the source limits, finds the missing evidence, asks the right human question, and leaves UiPath with a traceable record.
```

## Claims To Avoid

Do not say:

- "We automate underwriting."
- "We predict the risk."
- "We clear this asset."
- "This is a certified GIS assessment."
- "The frontend is already live-connected to UiPath Cloud."

Say:

- "We prepare review-ready material."
- "UiPath orchestrates the workflow."
- "The reviewer stays in control."
- "The record is traceable."
