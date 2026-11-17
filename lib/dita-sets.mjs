// The DITA projects the studio demonstrates: which documents make up each one. scripts/dita-sample.mjs writes and
// publishes them to content/dita-samples/<id>/, and lib/samples.mjs lists them for the DITA Studio.
export const SETS = {
  "industrial-equipment": { title: "Industrial equipment documentation", map: "Feed pump B: inspection and calibration", scenario: "a-industrial",
    docs: ["content/workbench/maintenance-procedure.md", "content/scenarios/a-industrial/inspection-record.md", "content/workbench/engineering-procedure.md", "content/workbench/technical-report.md"] },
  "developer-documentation": { title: "Developer documentation", map: "Lattice Relay developer documentation", scenario: "c-cloud",
    docs: ["content/scenarios/c-cloud/concept-how-relay-works.md", "content/scenarios/c-cloud/developer-guide-deploy.md", "content/scenarios/c-cloud/troubleshooting-deliveries.md", "content/scenarios/c-cloud/reference-configuration.md"] },
  "saas-product-help": { title: "SaaS product help", map: "Ledgerly help: sign-in and access", scenario: "e-support",
    docs: ["content/scenarios/e-support/kb/fix-sign-in-problems.md", "content/scenarios/e-support/kb/reset-your-password.md", "content/scenarios/e-support/kb/why-your-account-is-locked.md", "content/scenarios/e-support/kb/manage-users-and-roles.md", "content/scenarios/e-support/kb/sign-in-and-security-faq.md"] },
  "technical-reference": { title: "Technical reference", map: "Reference set: roles, escalation and configuration", scenario: "h-publishing",
    docs: ["content/scenarios/b-enterprise-it/roles-and-responsibilities.md", "content/scenarios/d-security/reference-escalation.md", "content/scenarios/c-cloud/reference-configuration.md", "content/scenarios/f-release/version-history.md"] },
  "release-documentation": { title: "Release documentation", map: "Fieldbook 2.4 release documentation", scenario: "f-release",
    docs: ["content/scenarios/f-release/release-notes-2-4.md", "content/scenarios/f-release/migration-guide.md", "content/scenarios/f-release/version-history.md"] },
  "workbench-templates": { title: "The workbench's templates", map: "Acme Console help (fictional sample)", scenario: "h-publishing",
    docs: ["content/workbench/how-to.md", "content/workbench/troubleshooting.md", "content/workbench/reference.md", "content/workbench/release-notes.md", "content/workbench/faq.md", "content/workbench/explainer.md", "content/workbench/sop.md", "content/workbench/engineering-procedure.md", "content/workbench/maintenance-procedure.md", "content/workbench/technical-report.md", "content/workbench/developer-guide.md", "content/workbench/incident-runbook.md"] },
};
