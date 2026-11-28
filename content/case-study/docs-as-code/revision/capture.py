"""Takes a Keycloak 26.8.2 instance running on this computer through one real task, resetting a user's one-time password,
and keeps a screenshot of each step, the boxes of the controls a step names, and the server's own record of each change.

    python3 kc_capture.py <output folder>

Needs the realm "portfolio-demo" with the user alex.morgan enrolled in OTP, and the master-realm administrator sam.rivera.
The passwords are read from files in the Keycloak folder; they never appear in the output.
"""
import base64, hashlib, hmac, json, struct, sys, time, urllib.parse, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

KC, REALM, USER = "http://127.0.0.1:8180", "portfolio-demo", "alex.morgan"
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
SECRETS = Path("/home/claude/v101/keycloak")
apw, upw = (SECRETS / "docs-admin-pass.txt").read_text().strip(), (SECRETS / "user-pass.txt").read_text().strip()
log = {"keycloak": "26.8.2", "realm": REALM, "user": USER, "steps": [], "api": {}}
shots = {}


def totp(secret_b32, at=None):
    s = secret_b32.replace(" ", "").upper(); key = base64.b32decode(s + "=" * (-len(s) % 8))
    h = hmac.new(key, struct.pack(">Q", int((at or time.time()) // 30)), hashlib.sha1).digest(); o = h[-1] & 15
    return str((struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF) % 10 ** 6).zfill(6)


def api(path, method="GET", body=None):
    """The admin REST API, as sam.rivera: the record of what the console did."""
    tok = json.loads(urllib.request.urlopen(urllib.request.Request(f"{KC}/realms/master/protocol/openid-connect/token", data=urllib.parse.urlencode(
        {"grant_type": "password", "client_id": "admin-cli", "username": "sam.rivera", "password": apw}).encode())).read())["access_token"]
    req = urllib.request.Request(f"{KC}/admin/realms/{REALM}{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    raw = urllib.request.urlopen(req).read()
    return json.loads(raw) if raw else None


def uid():
    return api(f"/users?username={USER}&exact=true")[0]["id"]


def creds():
    return [{"type": c["type"], "userLabel": c.get("userLabel"), "created": c.get("createdDate")} for c in api(f"/users/{uid()}/credentials")]


def box(page, sel):
    b = page.locator(sel).first.bounding_box()
    if not b: raise SystemExit(f"no box for {sel}")
    return {k: round(v, 1) for k, v in b.items()}


def shot(page, name, marks=None, note=""):
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / f"{name}.png"))
    shots[name] = {"marks": marks or [], "note": note, "url": page.url.replace(KC, "")}
    print("shot", name, len(marks or []), "marks")


def admin_login(b):
    a = b.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1).new_page()
    a.goto(KC + "/admin/master/console/", wait_until="networkidle")
    a.fill("#username", "sam.rivera"); a.fill("#password", apw); a.click("#kc-login"); a.wait_for_load_state("networkidle"); a.wait_for_timeout(2500)
    return a


def go(a, hashpath):
    a.goto(f"{KC}/admin/master/console/#/{REALM}/{hashpath}", wait_until="networkidle"); a.reload(wait_until="networkidle"); a.wait_for_timeout(2500)


def user_signin(b, label):
    u = b.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1).new_page()
    u.goto(f"{KC}/realms/{REALM}/account", wait_until="networkidle")
    u.fill("#username", USER); u.fill("#password", upw); u.click("#kc-login"); u.wait_for_load_state("networkidle"); u.wait_for_timeout(1500)
    return u


def enroll(b, label):
    """Signs in as the user, who has the Configure OTP required action, and enrolls an authenticator with a code computed from its key."""
    u = user_signin(b, "setup")
    u.click("#mode-manual"); u.wait_for_load_state("networkidle")
    u.fill("#totp", totp(u.inner_text("#kc-totp-secret-key"))); u.fill("#userLabel", label); u.click("#saveTOTPBtn"); u.wait_for_load_state("networkidle")
    u.context.close()


with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    # The starting point: the user has one authenticator, "Alex's phone", and the event logs are empty.
    for c in api(f"/users/{uid()}/credentials"):
        if c["type"] == "otp": api(f"/users/{uid()}/credentials/{c['id']}", "DELETE")
    user = api(f"/users/{uid()}"); user["requiredActions"] = ["CONFIGURE_TOTP"]; api(f"/users/{uid()}", "PUT", user)
    enroll(b, "Alex's phone")
    api("/admin-events", "DELETE"); api("/events", "DELETE")
    log["api"]["before"] = creds()
    a = admin_login(b)

    # 1. Find the user.
    go(a, "users")
    a.fill("input[placeholder='Search user']", USER); a.keyboard.press("Enter"); a.wait_for_timeout(1500)
    shot(a, "01-find-user", [{"type": "rect", "box": box(a, "input[placeholder='Search user']")}, {"type": "rect", "box": box(a, f"table a:has-text('{USER}')"), "n": 1, "side": "right"}])

    # 2. The Credentials tab, with the OTP credential.
    a.click(f"table a:has-text('{USER}')"); a.wait_for_timeout(2000)
    a.click("[data-testid=credentials]"); a.wait_for_timeout(2000)
    otp_row = "table tbody tr:has-text('Otp')"
    shot(a, "02-credentials", [{"type": "rect", "box": box(a, "[data-testid=credentials]"), "n": 1, "side": "above"}, {"type": "rect", "box": box(a, otp_row), "n": 2}])

    # 3. The row's menu, with Delete.
    a.click(f"{otp_row} button[aria-label='Kebab toggle']"); a.wait_for_timeout(800)
    shot(a, "03-delete-menu", [{"type": "rect", "box": box(a, "[role=menuitem]:has-text('Delete')"), "n": 1}])

    # 4. The confirmation.
    a.click("[role=menuitem]:has-text('Delete')"); a.wait_for_timeout(1000)
    dialog_text = a.inner_text("[role=dialog]")
    confirm = "[role=dialog] button:has-text('Delete')"
    shot(a, "04-confirm-delete", [{"type": "rect", "box": box(a, confirm), "n": 1}], note=dialog_text)

    # 5. Deleted: only the password is left.
    a.click(confirm); a.wait_for_timeout(1500)
    alert = a.inner_text("[data-testid=global-alerts]") if a.locator("[data-testid=global-alerts]").count() else ""
    shot(a, "05-deleted", [{"type": "rect", "box": box(a, "table tbody")}], note=alert)
    log["api"]["after_delete"] = creds()
    log["steps"].append({"step": "delete", "alert": alert, "dialog": dialog_text})

    # 6. What happens if the reset stops here: the user signs in with the password alone.
    u = user_signin(b, "after-delete")
    log["steps"].append({"step": "signin-without-required-action", "url": u.url.replace(KC, ""), "page": u.title(), "otp_prompt": u.locator("#totp").count() > 0})
    shot(u, "06-password-only", [], note=u.inner_text("body")[:200])
    u.context.close()

    # 7. Require a new authenticator: Configure OTP in Required user actions, then Save.
    a.click("[data-testid=user-details-tab]"); a.wait_for_timeout(1500)
    a.click("input[placeholder='Select action']"); a.wait_for_timeout(800)
    a.click("[role=option]:has-text('Configure OTP')"); a.wait_for_timeout(800)
    a.keyboard.press("Escape"); a.wait_for_timeout(300)
    field = a.locator("input[placeholder='Select action']").locator("xpath=ancestor::div[contains(@class,'pf-v5-c-menu-toggle') or contains(@class,'pf-v6-c-menu-toggle')][1]")
    fbox = field.bounding_box() if field.count() else a.locator("input[placeholder='Select action']").bounding_box()
    shot(a, "07-required-action", [{"type": "rect", "box": {k: round(v, 1) for k, v in fbox.items()}, "n": 1, "side": "above"}, {"type": "rect", "box": box(a, "[data-testid=user-creation-save]"), "n": 2}])
    a.click("[data-testid=user-creation-save]"); a.wait_for_timeout(1500)
    alert = a.inner_text("[data-testid=global-alerts]") if a.locator("[data-testid=global-alerts]").count() else ""
    shot(a, "08-saved", [], note=alert)
    log["api"]["required_actions"] = api(f"/users/{uid()}")["requiredActions"]
    log["steps"].append({"step": "required-action", "alert": alert})

    # 8. The user signs in and must set up a new authenticator. A wrong code first, then the right one.
    u = user_signin(b, "re-enroll")
    log["steps"].append({"step": "signin-with-required-action", "page": u.inner_text("h1") if u.locator("h1").count() else u.title(), "otp_prompt": u.locator("#totp").count() > 0})
    shot(u, "09-setup", [{"type": "redact", "box": box(u, "#kc-totp-secret-qr-code")}])
    # The code and the device name are below the fold: the second picture shows them.
    u.locator("#saveTOTPBtn").scroll_into_view_if_needed(); u.wait_for_timeout(300)
    qb = u.locator("#kc-totp-secret-qr-code").bounding_box()
    hide = [{"type": "redact", "box": {k: round(v, 1) for k, v in qb.items()}}] if qb and qb["y"] + qb["height"] > 0 else []
    shot(u, "09b-setup-code", hide + [{"type": "rect", "box": box(u, "#totp"), "n": 1}, {"type": "rect", "box": box(u, "#userLabel"), "n": 2}, {"type": "rect", "box": box(u, "#saveTOTPBtn"), "n": 3}])
    u.evaluate("window.scrollTo(0, 0)")
    u.click("#mode-manual"); u.wait_for_load_state("networkidle")
    key = u.inner_text("#kc-totp-secret-key")
    u.fill("#totp", "000000"); u.fill("#userLabel", "Alex's new phone"); u.click("#saveTOTPBtn"); u.wait_for_load_state("networkidle"); u.wait_for_timeout(800)
    wrong = u.inner_text("body")
    err = [l for l in wrong.split("\n") if "nvalid" in l]
    # The message sits by the code field, below the fold: bring the field into view, and hide the key if it is still on screen.
    u.locator("#totp").scroll_into_view_if_needed(); u.evaluate("window.scrollBy(0, 160)"); u.wait_for_timeout(400)
    kb = u.locator("#kc-totp-secret-key").bounding_box()
    marks = [{"type": "redact", "box": {k: round(v, 1) for k, v in kb.items()}}] if kb and kb["y"] + kb["height"] > 0 and kb["y"] < 800 else []
    msg = u.locator("text=Invalid authenticator code.").first
    if msg.count(): marks.append({"type": "rect", "box": {k: round(v, 1) for k, v in msg.bounding_box().items()}, "n": 1})
    shot(u, "10-wrong-code", marks, note="; ".join(err))
    log["steps"].append({"step": "wrong-code", "message": err})
    key = u.inner_text("#kc-totp-secret-key") if u.locator("#kc-totp-secret-key").count() else key
    u.fill("#totp", totp(key)); u.fill("#userLabel", "Alex's new phone"); u.click("#saveTOTPBtn"); u.wait_for_load_state("networkidle"); u.wait_for_timeout(1500)
    log["steps"].append({"step": "enrolled", "url": u.url.replace(KC, ""), "title": u.title()})
    u.context.close()

    # 9. The new authenticator in the console.
    go(a, f"users/{uid()}/credentials")
    shot(a, "11-new-credential", [{"type": "rect", "box": box(a, "table tbody tr:has-text('Otp')"), "n": 1}])
    log["api"]["after"] = creds()

    # 10. The record: admin events.
    go(a, "events")
    a.click("[data-testid=admin-events-tab]"); a.wait_for_timeout(2000)
    rows = a.eval_on_selector_all("table tbody tr", "rs => rs.map(r => r.innerText.replace(/\\s+/g, ' ').trim()).slice(0, 8)")
    del_row = "table tbody tr:has-text('ACTION')"
    shot(a, "12-admin-events", [{"type": "rect", "box": box(a, del_row), "n": 1}] if a.locator(del_row).count() else [], note=json.dumps(rows))
    log["api"]["admin_events"] = [{"operation": e["operationType"], "resource": e["resourceType"], "path": e["resourcePath"].replace(uid(), "<user id>")} for e in api("/admin-events?max=10")]

    # 11. The OTP policy, for the reference.
    go(a, "authentication/policies")
    a.click("[data-testid=otpPolicy]"); a.wait_for_timeout(2000)
    shot(a, "13-otp-policy", [])
    realm = api("")
    log["api"]["otp_policy"] = {k: realm[k] for k in realm if k.startswith("otpPolicy") or k == "otpSupportedApplications"}
    b.close()

(OUT / "capture.json").write_text(json.dumps({"log": log, "shots": shots}, indent=1))
print(json.dumps(log, indent=1)[:3000])
