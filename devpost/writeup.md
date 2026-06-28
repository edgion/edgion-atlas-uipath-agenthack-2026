# Devpost Project Copy

## Project Name

Edgion Atlas: Agent-Prepared Physical-Risk Work-up

## Tagline

Turning scattered physical-risk signals into review-ready material through a UiPath-orchestrated human-in-the-loop workflow.

## What It Does

Edgion Atlas prepares the messy middle of a physical-risk review. The hackathon demo uses a synthetic data-centre case to show the pattern: source checks, spatial and temporal context, missing resilience evidence, a human review action, and a decision record.

The reviewer does not get a black-box score. They get a case file: what the agent used, what each source can support, what is missing, what evidence request should be opened, what the human selected, and what should be recorded. The useful agent here is not the one that pretends to clear the asset. It is the one that knows what not to decide.

## Inspiration

Physical-risk review for high-value assets usually starts with scattered evidence: hazard models, public layers, reports, asset files, resilience notes, and internal assumptions. Specialist teams can work through that, but it is slow and hard to repeat. Teams without deep specialist capacity may not have a consistent way to prepare the review file at all.

We wanted to show a narrower role for agents: prepare the specialist material, then let UiPath govern the case path around it.

## How We Built It

The project has three parts:

1. A browser specialist workbench that shows the demo asset case, selected sources, work-up, evidence requests, human review, and decision record.
2. A local Node workflow bridge that records case state. It produces a Queue-compatible payload with queue reference fields, SLA / retry controls, escalation routing, modeled human review fields, stage status, event history, and an audit packet.
3. A UiPath Studio Web / Maestro BPMN process that shows the same case path in UiPath.

The UiPath process covers queue intake, source-pack loading, specialist work-up, evidence request creation with SLA controls, a modeled human review task, reviewer action capture, and audit packet generation. The bridge payload keeps the control fields visible: evidence-missing SLA, retry / wait state, escalation to the portfolio risk lead, manual override, and audit-ready output.

Coding agents were used as scoped contributors. They helped narrow the product scope, implement and test the browser prototype and local workflow bridge, review claims, prepare the deck source, and draft the demo narrative. Human review controlled the final product direction, claims, and submission decisions. The repository includes `docs/agents.md` with the tools used and the artifacts they helped produce.

## How UiPath Is Used

UiPath controls the case path. The Maestro BPMN process creates the queue-compatible intake item, runs source-pack and specialist-workup script tasks, and checks work-up readiness. It then applies SLA / retry / escalation controls, models the human handoff, captures reviewer action, and generates the audit decision packet. The debug run succeeded, validation showed no issues, and the workflow was published as `Solution ver. 1.0.1`.

UiPath owns the governed case workflow; Edgion agents provide the specialist work-up; the human reviewer owns the business decision.

The local prototype includes an optional UiPath Orchestrator queue adapter. In local review mode, it runs without credentials. It still produces the same Queue-compatible payload shape that would be sent to UiPath in production. That payload includes the `DataCentrePhysicalRiskReview` queue name, reference id, evidence request ids, SLA / retry controls, human-task model, reviewer action, stage status, event history, and decision packet sections. The local mode does not claim live Queue submission or a live Action Center task.

## What The Agents Do

The agents prepare work, not final decisions:

- Source agent: checks source type, scale, horizon, intended use, and caveats.
- Specialist work-up agent: prepares spatial/temporal context and reviewer questions.
- Resilience evidence agent: identifies missing site-level evidence for the active asset class. In this demo, that means data-centre resilience evidence.
- Record agent: compiles the evidence context, human action, limitations, and audit trail.

The human reviewer remains in control of the final business action.

## Challenges

The main challenge was keeping the scope honest. A physical-risk product can easily drift into risk scoring, underwriting, GIS certification, engineering review, or climate modelling. We narrowed the MVP to review preparation and workflow control.

For hackathon reliability, the Studio Web process runs self-contained script-task payloads. It preserves the same queue-compatible fields, gateways, human-handoff fields, and decision-record outputs used by the local bridge. That made the BPMN process reliable enough to debug and publish while leaving a clear path for production Queue/API/Action Center integration. The local package does not claim a live Action Center task; it models the human task fields and output boundary explicitly.

## Accomplishments

- Built a working browser prototype for a complete case-to-record flow.
- Built a local workflow bridge with a generated Queue-compatible payload, SLA / retry / escalation controls, stage status, event history, and audit-ready output.
- Built and published a UiPath Maestro BPMN process.
- Preserved the human-in-the-loop boundary.
- Created a narrow, explainable MVP instead of overclaiming automated underwriting.

## What We Learned

The strongest role for agents here is not replacing professional judgment. It is preparing the material so professional judgment can happen faster and leave a clearer record.

## What's Next

- Replace mock payloads with live Queue/API intake.
- Add live Action Center or Action App human review.
- Connect source retrieval and specialist agents to live data services.
- Store decision records in an auditable portfolio system.
- Extend the same pattern to other infrastructure asset classes and hazard contexts.
