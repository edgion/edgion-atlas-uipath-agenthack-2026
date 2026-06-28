# Coding Agents Usage

This project used coding agents as build partners during the hackathon. Human review stayed in control of product scope, final claims, and submission decisions.

## Tools Used

- Coding-agent sessions for local repository work, code review, test execution, deck source updates, and submission-package checks.
- Parallel coding-agent review sessions for product, narrative, and implementation review.
- Reviewer assistants for design review, video planning, product critique, and workflow discussion.

## What The Agents Helped With

- Product scoping: narrowing the build from a broad climate-risk platform to a physical-risk work-up layer.
- Prototype implementation: browser workbench, workflow bridge, test coverage, and local run instructions.
- UiPath handoff: workflow payload structure, BPMN narrative, and submission evidence.
- Review: checking public claims so the project does not overstate underwriting, pricing, certified GIS, engineering, or live UiPath integration.
- Presentation: deck source, demo script, and video handoff material.

## Human Control

Agents did not make final business, underwriting, pricing, or engineering decisions. They prepared material, proposed structure, and checked consistency. Final product direction, boundaries, and submission approval remained human-controlled.

## Verifiable Project Evidence

- `prototype/`: working browser prototype and tests.
- `prototype/workflow_bridge_server.mjs`: local workflow bridge.
- `prototype/uipath_adapter.mjs`: optional UiPath queue adapter.
- `uipath/sample_payload.json`: generated workflow payload shape.
- `uipath/screenshots/`: UiPath Studio Web / Maestro BPMN screenshots.
- `docs/demo_script.md`: final demo narrative.
- `deck/source.html`: deck source generated and iterated with agent assistance.
