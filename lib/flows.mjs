// The explainer at /sign-in-flows: OAuth 2.0, OpenID Connect, SAML 2.0 and single sign-on, each as a sequence a reader
// steps through. The page is whole without a script: every step is in an ordered list under its diagram, and the
// diagram is a picture of that list. src/flows.js then shows one step at a time and marks it in the diagram.
//
// Every host, client, user and token below is invented, on example.com (reserved for documentation by RFC 2606). The
// PKCE verifier and challenge are the example pair of RFC 7636, Appendix B, so a reader can check the hash. The
// sequences follow the specifications named in SOURCES; each flow says which one.
import { esc } from "./util.mjs";

const SOURCES = [
  ["RFC 6749", "The OAuth 2.0 Authorization Framework", "https://www.rfc-editor.org/rfc/rfc6749"],
  ["RFC 7636", "Proof Key for Code Exchange by OAuth Public Clients", "https://www.rfc-editor.org/rfc/rfc7636"],
  ["RFC 6750", "The OAuth 2.0 Authorization Framework: Bearer Token Usage", "https://www.rfc-editor.org/rfc/rfc6750"],
  ["OpenID Connect Core 1.0", "The ID token, its claims and how to validate it", "https://openid.net/specs/openid-connect-core-1_0.html"],
  ["SAML 2.0 Profiles", "The Web Browser SSO Profile (OASIS)", "https://docs.oasis-open.org/security/saml/v2.0/saml-profiles-2.0-os.pdf"],
  ["SAML 2.0 Bindings", "The HTTP Redirect and HTTP POST bindings (OASIS)", "https://docs.oasis-open.org/security/saml/v2.0/saml-bindings-2.0-os.pdf"],
];

/* A step: path is the actors a message passes, by index (one index is work done by that actor alone); label is the
   few words on the diagram; title, text and checks are the list's; code is what is sent, as a reader would see it. */
const FLOWS = [
  {
    id: "oauth", name: "OAuth 2.0", title: "OAuth 2.0: the authorization code grant with PKCE",
    answers: "May this app call that API for this user?",
    intro: "OAuth 2.0 is about authorization. An app gets an access token that lets it call an API for a user, within the scopes the user agreed to. The user’s password never reaches the app. This is the authorization code grant with PKCE, from RFC 6749 and RFC 7636.",
    actors: [["Browser", "The user"], ["Client", "app.example.com"], ["Authorization server", "login.example.com"], ["Resource server", "api.example.com"]],
    steps: [
      { path: [0, 1], label: "Connect my reports", title: "The user asks the app to connect", text: "The user selects a button in the app. Nothing about OAuth has happened yet.", code: "GET /connect HTTP/1.1\nHost: app.example.com" },
      { path: [1], label: "state, verifier, challenge", title: "The client prepares the request", text: "The client makes two random values. <code>state</code> ties the answer to this browser session. <code>code_verifier</code> stays on the client; its SHA-256 hash, the <code>code_challenge</code>, goes in the request.", code: "state          = af0ifjsldkj\ncode_verifier  = dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk\ncode_challenge = E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" },
      { path: [1, 0, 2], label: "Authorization request", title: "The client sends the browser to the authorization server", text: "A redirect carries the request through the browser. It names the client, where to send the answer, and the scope asked for.", code: "HTTP/1.1 302 Found\nLocation: https://login.example.com/authorize\n  ?response_type=code\n  &client_id=demo-app\n  &redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback\n  &scope=reports.read\n  &state=af0ifjsldkj\n  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM\n  &code_challenge_method=S256", checks: ["The authorization server accepts only a redirect URI registered for this client."] },
      { path: [2, 0], label: "Sign in and consent", title: "The authorization server signs the user in and asks for consent", text: "The user proves who they are to the authorization server, then agrees that the app may read their reports. The client sees none of this." },
      { path: [2, 0, 1], label: "code and state", title: "The authorization server sends the browser back with a code", text: "The code is short-lived and works once. It is not a token: on its own it opens nothing.", code: "HTTP/1.1 302 Found\nLocation: https://app.example.com/callback\n  ?code=SplxlOBeZQQYbYS6WxSbIA\n  &state=af0ifjsldkj", checks: ["The client compares <code>state</code> with the value it sent, and stops if they differ."] },
      { path: [1, 2], label: "Token request", title: "The client exchanges the code for a token", text: "This request goes from the client to the authorization server directly, not through the browser. It carries the code and the <code>code_verifier</code> the client kept.", code: "POST /token HTTP/1.1\nHost: login.example.com\nContent-Type: application/x-www-form-urlencoded\n\ngrant_type=authorization_code\n&code=SplxlOBeZQQYbYS6WxSbIA\n&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback\n&client_id=demo-app\n&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" },
      { path: [2, 1], label: "Access token", title: "The authorization server returns an access token", text: "The server checks the code, then hashes the verifier and compares it with the challenge from step 3. A code stolen on the way is useless without the verifier.", code: "HTTP/1.1 200 OK\nContent-Type: application/json\nCache-Control: no-store\n\n{\n  \"access_token\": \"demo-access-token-not-real\",\n  \"token_type\": \"Bearer\",\n  \"expires_in\": 300,\n  \"scope\": \"reports.read\"\n}", checks: ["The code was issued to this client, for this redirect URI, and has not been used.", "SHA-256 of <code>code_verifier</code> equals <code>code_challenge</code>."] },
      { path: [1, 3], label: "API call with the token", title: "The client calls the API", text: "The access token goes in the <code>Authorization</code> header (RFC 6750).", code: "GET /reports HTTP/1.1\nHost: api.example.com\nAuthorization: Bearer demo-access-token-not-real" },
      { path: [3, 1], label: "The reports", title: "The resource server checks the token and answers", text: "The API accepts the token only if it is genuine, meant for this API, not expired, and carries the scope the request needs.", code: "HTTP/1.1 200 OK\nContent-Type: application/json\n\n{ \"reports\": [ { \"id\": \"r-001\", \"title\": \"Example report\" } ] }", checks: ["Signature or introspection: the authorization server issued it.", "Audience, expiry time and scope fit this request."] },
    ],
    result: "The app can read this user’s reports for five minutes. OAuth 2.0 alone doesn’t tell the app who the user is: the access token is for the API, and its format is the authorization server’s business.",
  },
  {
    id: "oidc", name: "OpenID Connect", title: "OpenID Connect: the authorization code flow",
    answers: "Who is the user that just signed in?",
    intro: "OpenID Connect adds authentication to OAuth 2.0. The same redirects run, with the scope <code>openid</code>, and the token response gains an ID token: a signed statement about the sign-in, addressed to the client. This is the authorization code flow of OpenID Connect Core 1.0.",
    actors: [["Browser", "The user"], ["Relying party", "app.example.com"], ["OpenID provider", "login.example.com"]],
    steps: [
      { path: [0, 1], label: "Open the app", title: "The user opens the app without a session", text: "The app has no session for this browser, so it starts a sign-in.", code: "GET /dashboard HTTP/1.1\nHost: app.example.com" },
      { path: [1], label: "state and nonce", title: "The relying party prepares the request", text: "As well as <code>state</code>, it makes a <code>nonce</code>. The provider must put the nonce in the ID token, which ties that token to this request. PKCE applies as in the OAuth 2.0 flow; it is left out here to keep the picture short.", code: "state = af0ifjsldkj\nnonce = n-0S6_WzA2Mj" },
      { path: [1, 0, 2], label: "Authentication request", title: "The relying party sends the browser to the provider", text: "The request is an OAuth 2.0 authorization request whose scope includes <code>openid</code>. That one word makes it an authentication request.", code: "HTTP/1.1 302 Found\nLocation: https://login.example.com/authorize\n  ?response_type=code\n  &client_id=demo-app\n  &redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback\n  &scope=openid%20profile%20email\n  &state=af0ifjsldkj\n  &nonce=n-0S6_WzA2Mj" },
      { path: [2, 0], label: "Sign in", title: "The provider authenticates the user", text: "The user signs in at the provider: a password, a one-time code, a passkey, whatever its policy asks for. The relying party never sees the credentials." },
      { path: [2, 0, 1], label: "code and state", title: "The provider sends the browser back with a code", text: "As in OAuth 2.0: a short-lived code that works once, and the <code>state</code> to compare.", code: "HTTP/1.1 302 Found\nLocation: https://app.example.com/callback\n  ?code=SplxlOBeZQQYbYS6WxSbIA\n  &state=af0ifjsldkj", checks: ["<code>state</code> equals the value the relying party sent."] },
      { path: [1, 2], label: "Token request", title: "The relying party exchanges the code", text: "A direct request to the provider’s token endpoint, authenticated as the client.", code: "POST /token HTTP/1.1\nHost: login.example.com\nContent-Type: application/x-www-form-urlencoded\n\ngrant_type=authorization_code\n&code=SplxlOBeZQQYbYS6WxSbIA\n&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback\n&client_id=demo-app" },
      { path: [2, 1], label: "ID token and access token", title: "The provider returns an ID token and an access token", text: "The ID token is a JSON Web Token: a header, the claims and a signature. The claims below are what it says once decoded.", code: "HTTP/1.1 200 OK\nContent-Type: application/json\nCache-Control: no-store\n\n{\n  \"id_token\": \"(header).(claims).(signature)\",\n  \"access_token\": \"demo-access-token-not-real\",\n  \"token_type\": \"Bearer\",\n  \"expires_in\": 300\n}\n\nThe ID token’s claims, decoded:\n{\n  \"iss\": \"https://login.example.com\",\n  \"sub\": \"248289761001\",\n  \"aud\": \"demo-app\",\n  \"iat\": 1700000000,\n  \"exp\": 1700000300,\n  \"nonce\": \"n-0S6_WzA2Mj\"\n}" },
      { path: [1], label: "Validate the ID token", title: "The relying party validates the ID token", text: "Only after every check passes does the relying party treat the user as signed in and start its own session. It identifies the user by <code>iss</code> and <code>sub</code> together, not by an email address, which can change.", checks: ["The signature verifies with a key the provider publishes (its JWKS).", "<code>iss</code> is the provider it sent the user to.", "<code>aud</code> contains its own client ID.", "<code>exp</code> is in the future.", "<code>nonce</code> equals the value from step 2."] },
      { path: [1, 2, 1], label: "UserInfo, if needed", title: "The relying party may ask for more about the user", text: "The access token opens the provider’s UserInfo endpoint, which returns the claims the scopes allow. This step is optional.", code: "GET /userinfo HTTP/1.1\nHost: login.example.com\nAuthorization: Bearer demo-access-token-not-real\n\nHTTP/1.1 200 OK\nContent-Type: application/json\n\n{\n  \"sub\": \"248289761001\",\n  \"name\": \"Alex Demo\",\n  \"email\": \"alex.demo@example.com\"\n}", checks: ["<code>sub</code> is the same as in the ID token."] },
    ],
    result: "The app knows which user signed in, when, and at which provider. The ID token is for the client to read; the access token is still for an API. Sending an ID token to an API as if it were an access token is a common mistake.",
  },
  {
    id: "saml", name: "SAML 2.0", title: "SAML 2.0: single sign-on started at the service provider",
    answers: "Who is the user, according to the organization’s identity provider?",
    intro: "SAML 2.0 does the job of OpenID Connect with XML. The identity provider signs an assertion about the user, and the browser carries it to the service provider in a form. It is older than OpenID Connect and remains common for workforce sign-in to enterprise applications. This is the Web Browser SSO Profile, with the request by HTTP Redirect and the response by HTTP POST.",
    actors: [["Browser", "The user"], ["Service provider", "sp.example.com"], ["Identity provider", "idp.example.com"]],
    steps: [
      { path: [0, 1], label: "Open a protected page", title: "The user opens a page that needs a sign-in", text: "The service provider has no session for this browser.", code: "GET /reports HTTP/1.1\nHost: sp.example.com" },
      { path: [1], label: "Build the AuthnRequest", title: "The service provider writes an authentication request", text: "The request has an ID of its own. The response must quote that ID, which is how the service provider recognizes an answer to a question it asked.", code: "<samlp:AuthnRequest ID=\"_a1b2c3\" Version=\"2.0\"\n    IssueInstant=\"2026-11-25T09:00:00Z\"\n    Destination=\"https://idp.example.com/sso\"\n    AssertionConsumerServiceURL=\"https://sp.example.com/saml/acs\">\n  <saml:Issuer>https://sp.example.com/metadata</saml:Issuer>\n</samlp:AuthnRequest>" },
      { path: [1, 0, 2], label: "SAMLRequest by redirect", title: "The service provider sends the browser to the identity provider", text: "With the HTTP Redirect binding the request is compressed, Base64-encoded and put in the address. <code>RelayState</code> remembers where the user was going.", code: "HTTP/1.1 302 Found\nLocation: https://idp.example.com/sso\n  ?SAMLRequest=(the request, deflated and Base64-encoded)\n  &RelayState=%2Freports" },
      { path: [2, 0], label: "Sign in", title: "The identity provider authenticates the user", text: "The user signs in at the identity provider, or it finds the session it already has for this browser." },
      { path: [2, 0], label: "A form with the SAMLResponse", title: "The identity provider answers with a form", text: "An assertion is too long for an address, so the HTTP POST binding puts the response in a hidden field of a form that submits itself. The assertion inside is signed.", code: "<samlp:Response ID=\"_r7s8t9\" InResponseTo=\"_a1b2c3\" Version=\"2.0\"\n    Destination=\"https://sp.example.com/saml/acs\">\n  <saml:Issuer>https://idp.example.com/metadata</saml:Issuer>\n  <samlp:Status>\n    <samlp:StatusCode Value=\"urn:oasis:names:tc:SAML:2.0:status:Success\"/>\n  </samlp:Status>\n  <saml:Assertion ID=\"_d4e5f6\" Version=\"2.0\" IssueInstant=\"2026-11-25T09:00:20Z\">\n    <saml:Issuer>https://idp.example.com/metadata</saml:Issuer>\n    <ds:Signature>(the identity provider’s signature)</ds:Signature>\n    <saml:Subject>\n      <saml:NameID Format=\"urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress\">alex.demo@example.com</saml:NameID>\n      <saml:SubjectConfirmation Method=\"urn:oasis:names:tc:SAML:2.0:cm:bearer\">\n        <saml:SubjectConfirmationData InResponseTo=\"_a1b2c3\"\n            Recipient=\"https://sp.example.com/saml/acs\"\n            NotOnOrAfter=\"2026-11-25T09:05:20Z\"/>\n      </saml:SubjectConfirmation>\n    </saml:Subject>\n    <saml:Conditions NotBefore=\"2026-11-25T09:00:20Z\" NotOnOrAfter=\"2026-11-25T09:05:20Z\">\n      <saml:AudienceRestriction>\n        <saml:Audience>https://sp.example.com/metadata</saml:Audience>\n      </saml:AudienceRestriction>\n    </saml:Conditions>\n    <saml:AuthnStatement AuthnInstant=\"2026-11-25T09:00:18Z\" SessionIndex=\"_s1\"/>\n  </saml:Assertion>\n</samlp:Response>" },
      { path: [0, 1], label: "POST to the ACS", title: "The browser posts the response to the service provider", text: "The form goes to the service provider’s assertion consumer service (ACS), the address it named in its request and in its metadata.", code: "POST /saml/acs HTTP/1.1\nHost: sp.example.com\nContent-Type: application/x-www-form-urlencoded\n\nSAMLResponse=(the response, Base64-encoded)\n&RelayState=%2Freports" },
      { path: [1], label: "Validate the assertion", title: "The service provider validates the assertion", text: "The browser carried the assertion, so the service provider trusts nothing in it until the signature and every condition hold.", checks: ["The signature verifies with the identity provider’s certificate, taken from its metadata.", "<code>Issuer</code> is the identity provider it trusts.", "<code>InResponseTo</code> is the ID of a request it sent and has not yet seen answered.", "<code>Recipient</code> and <code>Destination</code> are its own ACS address.", "<code>Audience</code> is its own entity ID.", "The time is inside <code>NotBefore</code> and <code>NotOnOrAfter</code>.", "It has not accepted this assertion ID before."] },
      { path: [1, 0], label: "Session, then the page", title: "The service provider starts a session and shows the page", text: "The service provider sets its own session cookie and sends the browser to the address in <code>RelayState</code>.", code: "HTTP/1.1 302 Found\nLocation: https://sp.example.com/reports\nSet-Cookie: sp_session=(a new session); Secure; HttpOnly; SameSite=Lax" },
    ],
    result: "The service provider knows who the user is, on the identity provider’s word. No API is involved: SAML carries identity and attributes, not permission to call an API.",
  },
  {
    id: "sso", name: "Single sign-on", title: "Single sign-on: the second application",
    answers: "Why didn’t the second app ask me to sign in?",
    intro: "Single sign-on is a result, not a protocol: the user signs in once and reaches several applications. It happens because the identity provider keeps its own session with the browser. OpenID Connect and SAML 2.0 both give it. Here the user has already signed in to app A and now opens app B, with OpenID Connect.",
    actors: [["Browser", "The user"], ["App A", "a.example.com"], ["App B", "b.example.com"], ["Identity provider", "login.example.com"]],
    steps: [
      { path: [0, 1, 3], label: "Earlier: sign-in through app A", title: "Earlier, the user signed in through app A", text: "This was the whole OpenID Connect flow. Two sessions came out of it: app A’s, and the identity provider’s own, kept in a cookie that the browser sends only to <code>login.example.com</code>.", code: "Set-Cookie: idp_session=(the identity provider’s session);\n  Domain=login.example.com; Secure; HttpOnly; SameSite=Lax" },
      { path: [0, 2], label: "Open app B", title: "The user opens app B", text: "App B has never seen this browser. It can’t read app A’s cookie or the identity provider’s: a browser sends a cookie only to the site that set it.", code: "GET /inbox HTTP/1.1\nHost: b.example.com" },
      { path: [2, 0, 3], label: "Authentication request", title: "App B sends the browser to the identity provider", text: "An ordinary authentication request, with app B’s own client ID. Because the browser is now talking to <code>login.example.com</code>, it sends the identity provider’s session cookie along.", code: "GET /authorize?response_type=code&client_id=app-b\n  &redirect_uri=https%3A%2F%2Fb.example.com%2Fcallback\n  &scope=openid&state=k3Jx9pQ2&nonce=8dKq0wLm HTTP/1.1\nHost: login.example.com\nCookie: idp_session=(the identity provider’s session)" },
      { path: [3], label: "Session found: no prompt", title: "The identity provider recognizes its session", text: "The session is valid, so the identity provider doesn’t show a sign-in page. This is the moment of single sign-on. Policy can still require more: a session that is too old, a request with <code>prompt=login</code> or <code>max_age</code>, or an app that needs a second factor brings the prompt back.", checks: ["The session exists, has not expired and has not been ended.", "The user may use app B.", "The session’s authentication is recent and strong enough for app B’s policy."] },
      { path: [3, 0, 2], label: "code and state", title: "The identity provider sends the browser back to app B", text: "The user sees a brief redirect and no form.", code: "HTTP/1.1 302 Found\nLocation: https://b.example.com/callback\n  ?code=Qcb0Orv1zh30vL1MPRsbm\n  &state=k3Jx9pQ2" },
      { path: [2, 3, 2], label: "Code for app B’s own tokens", title: "App B exchanges the code for its own tokens", text: "The ID token is addressed to app B: its <code>aud</code> is <code>app-b</code>. App A’s tokens are never shared.", code: "The ID token’s claims, decoded:\n{\n  \"iss\": \"https://login.example.com\",\n  \"sub\": \"248289761001\",\n  \"aud\": \"app-b\",\n  \"iat\": 1700000900,\n  \"exp\": 1700001200,\n  \"nonce\": \"8dKq0wLm\"\n}", checks: ["App B validates its ID token exactly as in the OpenID Connect flow."] },
      { path: [2, 0], label: "App B’s own session", title: "App B starts its own session", text: "There are now three sessions: app A’s, app B’s and the identity provider’s. Each has its own lifetime.", code: "HTTP/1.1 302 Found\nLocation: https://b.example.com/inbox\nSet-Cookie: b_session=(a new session); Secure; HttpOnly; SameSite=Lax" },
    ],
    result: "One sign-in, two apps. Signing out is the harder half: ending the session in app A ends neither app B’s nor the identity provider’s unless single logout is set up, and each protocol has its own way to do that.",
  },
];

/** The sequence diagram of a flow: a picture of its list of steps. Each message is a group that the script can mark. */
function diagram(f) {
  const n = f.actors.length, W = 760, PAD = 86, ROW = 46, TOP = 78;
  const x = (i) => PAD + (i * (W - 2 * PAD)) / (n - 1);
  const H = TOP + f.steps.length * ROW + 16;
  let out = `<svg class="sf-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Sequence diagram of ${f.steps.length} steps between ${f.actors.map((a) => a[0]).join(", ")}. The list after it says the same in words.`)}">`;
  out += `<defs><marker id="sf-a-${f.id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" class="sf-head"/></marker></defs>`;
  f.actors.forEach(([name, host], i) => {
    out += `<line class="sf-life" x1="${x(i)}" y1="54" x2="${x(i)}" y2="${H - 6}"/>`;
    out += `<rect class="sf-actor" x="${x(i) - 78}" y="6" width="156" height="46" rx="6"/><text class="sf-an" x="${x(i)}" y="26" text-anchor="middle">${esc(name)}</text><text class="sf-ah" x="${x(i)}" y="43" text-anchor="middle">${esc(host)}</text>`;
  });
  f.steps.forEach((s, k) => {
    const y = TOP + k * ROW + 22, p = s.path;
    // The whole row answers a click, not only the thin line and the words.
    out += `<g class="sf-m" data-step="${k + 1}"><rect class="sf-hit" x="0" y="${TOP + k * ROW}" width="${W}" height="${ROW}"/>`;
    if (p.length === 1) {
      const cx = x(p[0]), right = p[0] < n - 1, w = Math.min(230, (W - 2 * PAD) / (n - 1) - 16);
      out += `<rect class="sf-self" x="${right ? cx + 8 : cx - 8 - w}" y="${y - 15}" width="${w}" height="26" rx="4"/><circle class="sf-dot" cx="${cx}" cy="${y - 2}" r="4"/>`;
      out += `<text class="sf-lab" x="${right ? cx + 8 + w / 2 : cx - 8 - w / 2}" y="${y + 3}" text-anchor="middle"><tspan class="sf-num">${k + 1}</tspan> ${esc(s.label)}</text>`;
    } else {
      const a = x(p[0]), b = x(p[p.length - 1]);
      if (p.length === 3) {
        // By way of a third party (a redirect through the browser, or a request and its answer): out on one line,
        // on to the receiver on the line under it.
        const via = x(p[1]), d2 = b > via ? 1 : -1;
        out += `<path class="sf-line" d="M${a} ${y - 6}H${via}V${y + 6}H${b - d2 * 2}" marker-end="url(#sf-a-${f.id})"/><circle class="sf-dot" cx="${via}" cy="${y}" r="4"/>`;
        out += `<text class="sf-lab" x="${(a + via) / 2}" y="${y - 12}" text-anchor="middle"><tspan class="sf-num">${k + 1}</tspan> ${esc(s.label)}</text>`;
      } else {
        const dir = b > a ? 1 : -1;
        out += `<path class="sf-line" d="M${a} ${y}H${b - dir * 2}" marker-end="url(#sf-a-${f.id})"/>`;
        out += `<text class="sf-lab" x="${(a + b) / 2}" y="${y - 7}" text-anchor="middle"><tspan class="sf-num">${k + 1}</tspan> ${esc(s.label)}</text>`;
      }
    }
    out += "</g>";
  });
  return out + "</svg>";
}

const who = (f, s) => s.path.length === 1 ? f.actors[s.path[0]][0] : s.path.map((i) => f.actors[i][0]).join(" → ");

function flow(f, i) {
  const steps = f.steps.map((s, k) => `<li class="sf-step" id="${f.id}-${k + 1}" data-step="${k + 1}">
<h3><span class="sf-k" aria-hidden="true">${k + 1}</span>${esc(s.title)}</h3>
<p class="sf-who">${esc(who(f, s))}</p>
<p>${s.text}</p>
${s.code ? `<pre class="code sf-code" tabindex="0" aria-label="${esc(`Step ${k + 1}, what is sent`)}"><code>${esc(s.code)}</code></pre>` : ""}
${s.checks ? `<div class="sf-checks"><p>${s.checks.length === 1 ? "The check" : "The checks"}</p><ul>${s.checks.map((c) => `<li>${c}</li>`).join("")}</ul></div>` : ""}
</li>`).join("\n");
  return `<section class="cs-stage sf-flow" id="${f.id}" aria-labelledby="${f.id}-h" data-flow="${f.id}">
<p class="cs-n">Flow ${i + 1} of ${FLOWS.length}</p>
<h2 id="${f.id}-h">${esc(f.title)}</h2>
<p class="sf-q"><b>The question it answers:</b> ${esc(f.answers)}</p>
<p>${f.intro}</p>
<figure class="sf-fig">${diagram(f)}</figure>
<ol class="sf-steps">
${steps}
</ol>
<p class="sf-result"><b>What comes out of it.</b> ${esc(f.result)}</p>
</section>`;
}

export function flowsPage() {
  const rows = [
    ["OAuth 2.0", "Authorization: letting an app call an API for a user", "An access token, for the API", "JSON over HTTPS; the token’s format is not fixed", "“Connect my calendar”, mobile and single-page apps calling APIs"],
    ["OpenID Connect", "Authentication, built on OAuth 2.0", "An ID token, for the app, with an access token", "JSON Web Token (JWT)", "“Sign in with …”, new web and mobile applications"],
    ["SAML 2.0", "Authentication and attributes", "A signed assertion, for the service provider", "XML, carried by the browser", "Workforce sign-in to enterprise and SaaS applications"],
    ["Single sign-on", "A result: one sign-in, several applications", "Nothing of its own: it reuses the identity provider’s session", "Whatever the protocol in use carries", "An employee opening one tool after another"],
  ];
  const body = `<article class="cs sf">
<header class="cs-head">
<p class="cs-kicker">Interactive explainer</p>
<h1>OAuth 2.0, OpenID Connect, SAML and single sign-on, step by step</h1>
<p class="cs-lead">Four names that are often used as if they meant the same thing. Each flow below is a sequence you can step through: who sends what to whom, what the message looks like, and what the receiver has to check.</p>
<p class="cs-note" role="note"><b>Example values.</b> The hosts, the client, the user and the tokens are invented, on example.com. Nothing here signs anyone in, and no value works anywhere. The PKCE verifier and challenge are the example pair of RFC 7636, Appendix B.</p>
<nav class="cs-steps" aria-label="Flows">${FLOWS.map((f, i) => `<a href="#${f.id}"><span>${i + 1}</span>${esc(f.name)}</a>`).join("")}</nav>
</header>

<section class="cs-stage" id="difference" aria-labelledby="difference-h">
<h2 id="difference-h">The difference in one table</h2>
<div class="sf-tbl" role="region" tabindex="0" aria-labelledby="difference-h"><table>
<thead><tr><th scope="col">Name</th><th scope="col">What it is for</th><th scope="col">What it issues</th><th scope="col">Format</th><th scope="col">Where you meet it</th></tr></thead>
<tbody>${rows.map((r) => `<tr><th scope="row">${esc(r[0])}</th>${r.slice(1).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
</table></div>
<p>The short version: OAuth 2.0 answers “may this app do that?”, OpenID Connect and SAML 2.0 answer “who is this?”, and single sign-on is what a user notices when an identity provider remembers them.</p>
</section>

${FLOWS.map(flow).join("\n\n")}

<section class="cs-stage" id="keycloak" aria-labelledby="keycloak-h">
<h2 id="keycloak-h">On a real identity server</h2>
<p>Keycloak is an open-source identity provider that speaks OpenID Connect and SAML 2.0. My guides for its administrators are written against a running Keycloak 26.8.2 server, with every screen captured from it:</p>
<ul>
<li><a href="/docs/keycloak/reset-otp">Reset a user’s one-time password in Keycloak</a></li>
<li><a href="/docs/keycloak/otp-troubleshooting">Troubleshoot sign-in codes</a></li>
<li><a href="/docs/keycloak/otp-policy">Choose an OTP policy</a></li>
</ul>
<p>Those guides document a product. This page explains protocols, with invented values, and was not recorded from a server.</p>
</section>

<section class="cs-stage" id="sources" aria-labelledby="sources-h">
<h2 id="sources-h">Sources</h2>
<p>The sequences, the parameter names and the checks follow these specifications. The wording and the examples are mine.</p>
<ul class="sf-src">${SOURCES.map(([n, t, u]) => `<li><a href="${u}">${esc(n)}</a>: ${esc(t)}</li>`).join("")}</ul>
</section>
</article>
<script src="/flows.js" defer></script>`;
  const text = FLOWS.map((f) => ({ id: f.id, title: f.title, text: `${f.answers} ${f.intro.replace(/<[^>]+>/g, "")} ${f.steps.map((s) => s.title).join(". ")}. ${f.result}` }));
  return { body, text, flows: FLOWS.length, steps: FLOWS.reduce((n, f) => n + f.steps.length, 0) };
}
