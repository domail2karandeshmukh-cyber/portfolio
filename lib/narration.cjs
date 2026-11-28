// The narration of the videos: the four portfolio films and the Documentation Studio's training videos.
// Each script is a list of segments. A segment is spoken on its own, so that its length can time the scene it
// belongs to, and so that the captions follow the words. The narrator's voice is not April's: this is a voiceover,
// she is the assistant. scripts/record-narration.mjs records the segments through the site's own speech service
// and keeps them in content/narration/<script>/<n>.<fingerprint>.mp3.
const crypto = require("crypto");

const SCRIPTS = {
  "style-check": {
    title: "Style checking in the workbench",
    segments: [
      { id: "opening", text: "This draft breaks my style guide on purpose. Let's see what the workbench does with it." },
      { id: "underlines", text: "Every red underline in the source is something to fix. Select Check to see them all." },
      { id: "findings", text: "The check names the rule behind each finding, says why it matters, and shows the fix." },
      { id: "one", text: "One fix rewrites one line of the source, and nothing else." },
      { id: "all", text: "Or take every fix at once. The draft now passes." },
      { id: "preview", text: "The same code checks every document in my library, so what you read here passed the same test." },
      { id: "card", text: "Write a document yourself, and watch it get checked, at karandeshmukh dot dev slash workbench." },
    ],
  },
  "one-source": {
    title: "One source, several readers",
    segments: [
      { id: "template", text: "One document can serve two kinds of reader. Start from the how-to template." },
      { id: "block", text: "In the source, these lines are marked for administrators only." },
      { id: "general", text: "A general reader's page leaves them out." },
      { id: "admin", text: "An administrator's page keeps them. Same source, two pages, no copy to keep in step." },
      { id: "publish", text: "Publish either page as Markdown, as HTML for a help center, or as DITA, where each step gets its own element." },
      { id: "card", text: "Try it on your own document at karandeshmukh dot dev slash workbench." },
    ],
  },
  "library": {
    title: "The documentation library",
    segments: [
      { id: "page", text: "Every document in the library says whether it passes my style check, right at the top." },
      { id: "read", text: "The contents list keeps your place as you read. Diagrams open at full size." },
      { id: "zoom", text: "This one shows how the security tool fits together." },
      { id: "search", text: "Search finds the section, not just the document, across the whole library." },
      { id: "card", text: "Read the documents at karandeshmukh dot dev slash docs." },
    ],
  },
  "rewrite-desk": {
    title: "The rewrite desk",
    segments: [
      { id: "headline", text: "My portfolio opens by correcting its own headline. Then it does the same to a message from your team." },
      { id: "tray", text: "Here is a sample: hotfix steps, the way they get typed in a chat." },
      { id: "markup", text: "Yellow marks a fact to keep. A red line is noise to cut." },
      { id: "draft", text: "Every fact lands in a first draft. An AI model writes it from my brief, and code checks that no name or number was lost." },
      { id: "questions", text: "In red, the questions the message leaves open. Drafting is the quick part. Getting them answered is the job." },
      { id: "card", text: "Paste a message of your own at karandeshmukh dot dev." },
    ],
  },
  "schedule-a-report": {
    title: "Schedule a report for automatic delivery",
    segments: [
      { id: "intro", text: "In this short tutorial, you schedule a report so that it reaches your team every Monday morning, without anyone opening Beacon Reports." },
      { id: "open", text: "Open the report you want to send. In the top-right corner, select Schedule." },
      { id: "recipients", text: "Under Recipients, type each email address and press Enter. The address appears as a chip. Recipients don't need a Beacon account." },
      { id: "repeat", text: "Choose how often the report is sent, the day, and the time. The time is shown in your own time zone." },
      { id: "format", text: "Choose the format: PDF for a report people read, Spreadsheet for one they work with. Then select Preview to see the subject line and the attachment's name." },
      { id: "save", text: "Select Save schedule." },
      { id: "done", text: "A message confirms the schedule and names the next delivery. The Schedules tab lists it, with Edit and Pause beside it. You're done." },
    ],
  },
  "inspection-walkthrough": {
    title: "Monthly inspection of feed pump B: recording the readings",
    segments: [
      { id: "intro", text: "This walkthrough shows the monthly inspection of feed pump B in the maintenance console. It's a fictional procedure, made for this portfolio." },
      { id: "open", text: "Open the work order. It lists the four checks and the expected range for each. Select Record readings." },
      { id: "enter", text: "Enter each reading as you took it from the local gauge: the discharge pressure in bar, the bearing temperature, the vibration, and whether the seal leaks. Then select Save readings." },
      { id: "check", text: "Every result now shows against its range. All four are inside it, so the work order is ready to close." },
      { id: "close", text: "Select Close work order. If any reading had been outside its range, you would report it to the shift supervisor instead." },
      { id: "outro", text: "That's the procedure. The written version, the step guide and the DITA output are in the same package." },
    ],
  },
  // The walkthrough of the aerospace demonstrations (scripts/film/films/aerospace.py). Recorded only when Karan
  // approves the cost of the voice service; until then the film is silent, and nothing calls it narrated.
  "aerospace": {
    title: "Aerospace technical publications, on a fictional training rig",
    segments: [
      { id: "overview", text: "These aerospace documentation demonstrations are built around one fictional training rig. Its documentation is an S1000D Issue 6 common source database: data modules, publication modules and illustrations." },
      { id: "csdb", text: "The common source database lists every module. For each one, it shows what refers to it, which publications use it, and what changed from one issue to the next." },
      { id: "editor", text: "In the editor, the form and the XML stay in step, and the checks run as you type. A two-digit issue number fails the identification check. Put the third digit back, and every layer passes again." },
      { id: "ste", text: "The Simplified Technical English checker marks each finding in the text, names its rule, and suggests a fix. Its word list is an original one, so it can't certify that a text complies." },
      { id: "ietm", text: "The interactive publication shows only what applies to the serial number you choose, and fault isolation asks one question at a time." },
      { id: "ipc", text: "In the parts catalogue, select a part in the exploded view, and its row in the parts list follows." },
      { id: "card", text: "Everything here is fictional, and none of it is maintenance data. Try it at karandeshmukh dot dev slash studio slash aerospace." },
    ],
  },
  "keycloak-reset-otp": {
    title: "Reset a user's OTP credential in Keycloak",
    segments: [
      { id: "intro", text: "When a user loses the phone that holds their authenticator app, reset its OTP credential in three moves, in this order: sign the user out, require a new authenticator, then delete the old one. This is Keycloak 26.8.2." },
      { id: "before", text: "Before you start, confirm that the request comes from the user, through a contact you had before the phone was lost. Then sign in to the admin console with an account that can manage the realm's users." },
      { id: "find", text: "Check that the user's realm is the current realm. Select Users, search for the user, and select their username." },
      { id: "sessions", text: "On the Sessions tab, select Logout all sessions, and then Confirm. An open session would otherwise reach the authenticator setup without the password." },
      { id: "require", text: "On the Details tab, in Required user actions, choose Configure OTP. Then select Save. Do this before you delete anything." },
      { id: "credentials", text: "Select the Credentials tab. The OTP row is the lost phone: its label names the device, Alex's phone." },
      { id: "delete", text: "Open the row's menu, and select Delete." },
      { id: "confirm", text: "Confirm with Delete. The phone's row is gone." },
      { id: "user", text: "At the next sign-in, after the password, Keycloak asks the user to set up an authenticator. They scan the QR code with the app on their new phone, type the code it shows, name the device, and select Submit." },
      { id: "verify", text: "To check, open the Credentials tab again. The new OTP row has the new device's name and today's date. And the admin events record the deletion." },
      { id: "close", text: "The written guide has every step, and what to do when a code is rejected. Find it in the library at karandeshmukh dot dev." },
    ],
  },
};

/** The file name of a segment's recording: the script, the segment, and a fingerprint of the words. */
const file = (script, seg) => `${script}/${seg.id}.${crypto.createHash("sha1").update(seg.text).digest("hex").slice(0, 10)}.mp3`;

module.exports = { SCRIPTS, file };
