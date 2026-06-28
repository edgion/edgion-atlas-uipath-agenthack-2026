# Edgion Atlas

A physical-risk review case file prepared by agents and controlled through UiPath.

This project was built for UiPath AgentHack 2026. It shows how a specialist agent workbench and a UiPath Maestro workflow can turn scattered physical-risk signals into a review file with a clear record before a human reviewer makes the business decision.

## Problem

Asset and infrastructure reviews rarely start with one clean dataset. They start with hazard layers, market signals, site notes, resilience records, and assumptions that do not all mean the same thing. Review teams do not need another unsupported score. They need the case material organized: which sources are useful, what they cannot support, what evidence is missing, and what a human reviewer still has to decide.

## What It Does

The prototype walks through one synthetic data-centre portfolio-review case as the first demonstration asset:

```text
Case intake
-> Source suitability
-> Specialist work-up
-> Evidence request preparation
-> Human review
-> Decision record
```

The browser workbench shows the review experience. A local workflow bridge records the case state. It also generates a Queue-compatible payload with queue reference fields, SLA / retry controls, escalation routing, a modeled human review task, and an audit-ready decision packet. In local mode this is not a live Orchestrator Queue transaction. The UiPath Studio Web / Maestro BPMN build shows how the same case is controlled in UiPath.

Core demo line: UiPath owns the governed case workflow; Edgion agents provide the specialist work-up; the human reviewer owns the business decision.

The public demo package includes prepared example layers for UI illustration.
Heat, wind, and rain overlays are synthetic screening proxies, not internal model
outputs, public climatological probability products, or production risk data.

## What Is Actually Running In UiPath

- A UiPath Studio Web / Maestro BPMN process was built for the case workflow.
- The BPMN includes queue intake, source-pack loading, specialist work-up, evidence-request routing with SLA controls, a modeled human review task, reviewer action capture, manual override metadata, and audit decision packet generation.
- The workflow uses gateways for work-up / evidence readiness and reviewer action routing.
- A debug execution completed successfully with no Studio validation issues.
- The process was published in the hackathon tenant as `Solution ver. 1.0.1`.

The local bridge and exported payload make the enterprise workflow controls explicit:

- Queue-compatible case payload: `DataCentrePhysicalRiskReview`, reference `TVDC01-2026-REVIEW`; local mode does not claim live Queue submission.
- Evidence control: 48-hour SLA, two retry attempts, missing-evidence escalation to the portfolio risk lead.
- Human task: modeled review task with allowed actions and output fields; not a live Action Center task in this local package.
- Audit output: structured workflow decision packet carrying queue item, work-up, execution plan, human task, decision record, stage status, and event history.

## UiPath Components Used

- UiPath Automation Cloud
- UiPath Studio Web
- UiPath Maestro BPMN
- Script tasks with mock payloads for hackathon reliability
- Decision gateways
- Debug execution
- Published solution package

The UiPath process was built, debugged successfully, and published in the hackathon tenant as `Solution ver. 1.0.1`. The current BPMN export is included in `uipath/process.bpmn`; clean v1.0.1 canvas screenshots are included in `uipath/screenshots/`.

## Agent Roles

The MVP uses agents as preparation workers, not as final decision makers:

- Source agent: classifies source type, scale, horizon, intended use, and caveats.
- Specialist work-up agent: prepares spatial/temporal context and translates scattered information into review-ready material.
- Resilience evidence agent: identifies missing site-level resilience evidence for the active asset class. In this demo, that asset is a data centre.
- Record agent: compiles the human action, evidence context, limitations, and audit trail into a decision record.

The human reviewer remains responsible for the business action.

## Coding Agents Used During Build

Coding agents helped with product scoping, prototype implementation, tests, submission review, and deck/video preparation. Human review set the final product boundary and submission claims.

See `docs/agents.md` for the tools used, what they contributed, and the verifiable project artifacts.

## Run Locally

Prerequisite: Node.js 18 or newer.

```bash
npm test
PORT=8770 npm start
```

Then open:

```text
http://127.0.0.1:8770/
```

The expected demo path is:

```text
Case -> Inputs -> Work-up -> Human review -> Record
```

The UI actions use product language such as `Prepare review package`, `Open request`, and `Create decision record`. Behind those actions, the workflow bridge records:

```text
case_created
workup_prepared
evidence_request_created
human_action_captured
final_payload_generated
```

## Optional UiPath Orchestrator Queue Adapter

The local bridge includes an adapter that can submit the generated workflow payload to a UiPath Orchestrator queue when environment variables are configured:

```text
UIPATH_ORCHESTRATOR_URL
UIPATH_ACCESS_TOKEN
UIPATH_FOLDER_ID
UIPATH_QUEUE_NAME
```

Without these variables, the prototype runs in local bridge mode. That is the expected mode for local review. The default preview payload is Queue-compatible and uses `DataCentrePhysicalRiskReview`, but it is not a live Queue transaction unless the adapter credentials are configured.

## Architecture

See `docs/architecture.md` for the workflow architecture and the boundary between the browser workbench, the local bridge, and UiPath Automation Cloud.

## Judging Evidence Map

- Business impact: turns messy physical-risk inputs into review material that an asset or portfolio team can actually use.
- UiPath platform usage: Maestro BPMN process, script tasks, gateways, debug execution, published package, Queue-compatible payload path, SLA / retry / escalation controls, human-task model, and audit packet.
- Technical execution: runnable browser prototype, local workflow bridge, adapter boundary, tests, and documented limitations.
- Completeness: case-to-record demo path, README setup, UiPath evidence screenshots, Devpost copy, deck, and video handoff.
- Creativity: agents prepare professional work-up material while leaving the business decision to a human reviewer.
- Coding-agent bonus: documented in `docs/agents.md`.

## Limitations

This is a hackathon MVP. It does not automate underwriting, pricing, site clearance, engineering certification, or insurability decisions. It also does not present synthetic screening overlays as production hazard data. See `docs/limitations.md`.

## Repository Structure

```text
prototype/
  Browser workbench and local workflow bridge.
uipath/
  UiPath build notes, payload sample, and screenshots.
docs/
  Architecture, limitations, coding-agent usage, demo script, and video notes.
devpost/
  Project copy for the Devpost submission page.
deck/
  Final submission deck PDF/source, contact sheet, and rendered slide PNGs.
```

## License

MIT.
