# Non-Functional Requirements Specification (NFRS)

## 1. Performance Targets

* Structured search/filter queries: under 150ms. This applies equally to the blurred-preview
  path (§12 FRS), since it runs the same query — no separate performance budget needed.
* Resume upload → "processing" acknowledgment shown to candidate within 2s.
* Full resume parse (AI extraction + deterministic rule pass): async job, target completion
  within ~30s. Never a blocking request on the upload endpoint.
* Admin queue visibility: no automated SLA enforcement or auto-escalation in MVP — items simply
  must not be invisible in the worklist. Given admin latency directly gates candidate publish
  rate (FRS §6), this is the parameter most worth watching post-launch even without automation.

## 2. File Handling

* Resume uploads: PDF/DOC/DOCX only, capped at 10MB.
* File type/size validated before any AI API call is made.

## 3. Portability

Includes pre-built Docker-Compose scripts for local staging setups.

## 4. Data Retention & Deletion

* Candidate account deletion (`User.deletedAt` soft-delete): profile PII (name, resume,
  employment history, contact info) becomes inaccessible immediately; the candidate drops out of
  search regardless of `isSearchable`. Existing `JobApplication`, `Note`, and
  `ApplicationHistory` rows tied to that candidate are **retained** — an employer's own hiring
  records are not retroactively erased by a candidate's deletion.
* This is a compliance-shaped decision made for MVP convenience, not a legal determination —
  revisit with legal/privacy input before any real launch with EU/CCPA-covered users.
* Workspace/employer deletion: existing `onDelete: Cascade` relations in the schema are
  sufficient; no candidate-side data is affected by an employer's deletion.
