# Limitations And Responsible Claims

## What This MVP Does

This MVP prepares review-ready material for a physical-risk review. The hackathon demo uses a data-centre case to make the workflow concrete. It helps a reviewer understand:

- which sources are being used;
- what each source can and cannot support;
- how hazard context relates to the asset;
- which site-level resilience evidence is missing;
- which evidence requests should be opened;
- what human action was selected;
- what should be recorded for the portfolio file.

## What This MVP Does Not Do

The MVP does not:

- make an underwriting decision;
- price insurance;
- clear or reject an asset;
- certify site resilience;
- replace engineering review;
- produce a GIS-certified site assessment;
- claim final flood, wind, heat, water, or wildfire risk for the asset;
- produce PML, MFL, BI, or valuation conclusions.

## Data Boundary

The demo uses a synthetic case and prepared source-pack examples. Some map layers and source labels are included to demonstrate the workflow pattern. They should not be treated as production-grade hazard outputs.

The public UI package includes synthetic heat, wind, and rain overlays for screening visualization. They are not internal model outputs, public climatological probability products, or production risk data.

## UiPath Boundary

The UiPath Studio Web / Maestro BPMN workflow is an orchestration proof. It uses the same case logic and mock payloads to show that the case can be run through a governed workflow. The browser frontend is not yet live-connected to UiPath Cloud in this local repository unless Orchestrator credentials are configured.

The local package models the human review task and exports the Queue-compatible payload, SLA / retry / escalation controls, and audit packet. It does not claim that a live Orchestrator Queue transaction, live Action Center task, live source connector, or persistent portfolio record store is already connected.

## Human-In-The-Loop Boundary

The human reviewer owns the final business action. The agents prepare material. They do not decide.
