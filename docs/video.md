# Demo Video Handoff

Target: 3:30 to 4:30. Hard limit: 5:00.

## Core Message

Edgion Atlas prepares specialist physical-risk review material for asset and portfolio teams. The hackathon demo uses a data-centre portfolio case, while UiPath orchestrates the governed workflow from intake to human review to decision record.

Do not frame the product as a risk score, an underwriting engine, or a climate model.

Core line: UiPath owns the governed case workflow; Edgion agents provide the specialist work-up; the human reviewer owns the business decision.

## Required Shots

1. Product opening shot:
   - Browser workbench running locally.
   - Show `Thames Valley DC-01`.
   - Say this is a synthetic data-centre review case.

2. Inputs / source suitability:
   - Show sources are not treated equally.
   - Mention scale, horizon, useful use, and caveats.

3. Work-up:
   - Show `Prepare review package`.
   - Show evidence request queue / specialist work-up.
   - Mention agents prepare review-ready material.

4. Human review:
   - Show reviewer action selection.
   - Make clear the human owns the business action.

5. Decision record:
   - Show the `site_asset_basis` evidence request, selected action, audit trail / payload.
   - Show `stageStatus` and `eventHistory` if the JSON payload is opened.
   - Mention traceability.

6. UiPath:
   - Show Maestro BPMN canvas.
   - Show debug success.
   - Show published package.
   - Mention the queue reference, missing-evidence retry / escalation path, and audit output.

7. Coding-agent evidence:
   - Keep this short, around 8-10 seconds.
   - Show `docs/agents.md` or the README coding-agents section.
   - Say coding agents helped implement, test, review claims, and prepare demo materials.

8. Architecture close:
   - Browser = specialist workbench.
   - Local bridge = workflow state.
   - UiPath = orchestration proof.
   - Human = final decision.

## Suggested Voiceover

A data-centre portfolio review gets a physical-risk signal. The problem is not that one more map is missing. The reviewer has hazard layers, market signals, site notes, resilience information, and internal assumptions, but no clean way to turn them into a bounded, auditable decision file.

Edgion Atlas does not try to replace the reviewer. It prepares the work-up before the reviewer acts.

In this demo, a synthetic case, Thames Valley DC-01, enters a portfolio physical-risk review. The workbench shows the asset context, the selected source pack, and the key issue: there are physical-risk signals, but the site-level resilience evidence is incomplete.

The agents prepare the review package. They check source suitability, spatial and temporal context, and asset-class resilience evidence gaps. In this demo, that asset class is a data centre. The output is not a final risk decision. It is review-ready material: what was used, what each source can support, what it cannot support, what evidence is missing, and what questions the reviewer should answer.

The strongest agent here is not the one that pretends to clear the asset. It is the one that knows the source limits, finds the missing evidence, asks the right human question, and leaves UiPath with a traceable record.

UiPath provides the governed workflow around that preparation. The case moves through intake, queue reference, specialist work-up, evidence request preparation, missing-evidence retry or escalation, human review, action capture, and decision record generation.

The human reviewer remains in control. In the demo, the reviewer selects the next business action, and the workflow produces a traceable decision record for the portfolio file.

The hackathon build uses a browser workbench, a local workflow bridge, and a UiPath Maestro BPMN process. The bridge exports a Queue-compatible payload with SLA, retry, escalation, modeled human-task fields, stage status, event history, and an audit packet. The local package does not claim live Queue submission or a live Action Center task. The UiPath workflow ran successfully in Studio Web and was published as Solution version 1.0.1.

The next step is to bind the modeled payload to live Queue/API triggers, Action Center human tasks, source connectors, and persistent audit storage.

## Do Say

- "review-ready material"
- "source suitability"
- "specialist work-up"
- "human-in-the-loop"
- "SLA, retry, and escalation controls"
- "traceable decision record"
- "UiPath orchestrates the workflow"

## Do Not Say

- "automated underwriting"
- "risk pricing"
- "certified GIS assessment"
- "engineering conclusion"
- "the frontend is already live-connected to UiPath Cloud"
- "live Action Center task is already connected"

## Current Assets

- Deck: `deck/edgion_atlas_deck.pdf`
- Deck source: `deck/source.html`
- Deck contact sheet: `deck/contact_sheet.png`
- Deck slide PNGs: `deck/slides/`
- UiPath screenshots: `uipath/screenshots/`
- Devpost copy: `devpost/writeup.md`
