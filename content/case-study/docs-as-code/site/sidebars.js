// One sidebar, ordered by what an administrator needs first: the idea, the task, the settings, and what to do when it fails.
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
export default {
  docs: [
    "index",
    { type: "category", label: "Concepts", collapsible: false, items: ["concepts/one-time-passwords"] },
    { type: "category", label: "How-to guides", collapsible: false, items: ["how-to/reset-otp"] },
    { type: "category", label: "Reference", collapsible: false, items: ["reference/otp-policy", "reference/terminology"] },
    { type: "category", label: "Troubleshooting", collapsible: false, items: ["troubleshooting/otp-sign-in"] },
  ],
};
