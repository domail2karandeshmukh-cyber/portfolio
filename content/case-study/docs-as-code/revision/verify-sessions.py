"""Checks two questions of the final security review, on Keycloak 26.8.2 running on this computer (realm
portfolio-demo, test user alex.morgan).
1. Does a session the user already had survive the reset? And does signing the user out end it?
2. With two OTP credentials, what does deleting one of them do to the next sign-in?
Passwords are read from local files and never printed. Writes sessions.json next to this file."""
import json, pathlib, time
from playwright.sync_api import sync_playwright
src = open(__file__.replace("verify-sessions.py", "capture.py")).read().split("with sync_playwright() as p:")[0]
src = src.replace("OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)", "OUT = Path('/tmp')")
ns = {}; exec(src, ns)
api, uid, user_signin, enroll, totp = ns["api"], ns["uid"], ns["user_signin"], ns["enroll"], ns["totp"]
KC, REALM = ns["KC"], ns["REALM"]

def next_period():
    """The realm's OTP policy doesn't accept a code twice, so a code typed again waits for the next 30-second period."""
    time.sleep(30 - time.time() % 30 + 1)
def otps(): return [c for c in api(f"/users/{uid()}/credentials") if c["type"] == "otp"]
def set_actions(a):
    u = api(f"/users/{uid()}"); u["requiredActions"] = a; api(f"/users/{uid()}", "PUT", u)
def sessions(): return api(f"/users/{uid()}/sessions")
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    def enroll_with(label, key=None):
        """Enrols an authenticator; with an earlier key, first types that device's code, as Keycloak asks for it."""
        set_actions(["CONFIGURE_TOTP"])
        u = user_signin(b, "setup")
        if key and u.locator("#otp").count():
            next_period(); u.fill("#otp", totp(key)); u.click("#kc-login"); u.wait_for_load_state("networkidle"); u.wait_for_timeout(800)
        u.click("#mode-manual"); u.wait_for_load_state("networkidle")
        new = u.inner_text("#kc-totp-secret-key").replace(" ", "")
        u.fill("#totp", totp(new)); u.fill("#userLabel", label); u.click("#saveTOTPBtn"); u.wait_for_load_state("networkidle"); u.context.close()
        return new
    def fresh(labels):
        for c in otps(): api(f"/users/{uid()}/credentials/{c['id']}", "DELETE")
        key = None
        for l in labels: key = enroll_with(l, key)
        api(f"/users/{uid()}/logout", "POST")
    # 1. A session opened with the old phone, before the reset: then the reset, in the guide's order.
    for c in otps(): api(f"/users/{uid()}/credentials/{c['id']}", "DELETE")
    key = enroll_with("Alex's phone"); api(f"/users/{uid()}/logout", "POST")
    u = user_signin(b, "session")
    next_period(); u.fill("#otp", totp(key)); u.click("#kc-login"); u.wait_for_load_state("networkidle"); u.wait_for_timeout(1200)
    before = len(sessions())
    set_actions(["CONFIGURE_TOTP"])
    for c in otps(): api(f"/users/{uid()}/credentials/{c['id']}", "DELETE")
    u.goto(f"{KC}/realms/{REALM}/account", wait_until="networkidle"); u.wait_for_timeout(1500)
    still_in = "/account" in u.url and u.locator("#username").count() == 0
    after_reset = {"page": u.url.split("?")[0].replace(KC, ""), "heading": (u.locator("h1").all_inner_texts() or [""])[0], "sessions": len(sessions())}
    api(f"/users/{uid()}/logout", "POST")
    u.goto(f"{KC}/realms/{REALM}/account", wait_until="networkidle"); u.wait_for_timeout(1500)
    after_logout_asks_password = u.locator("#username, #password").count() > 0
    res["existing session"] = {"sessions before the reset": before, "still signed in after the reset": still_in, "what the open browser shows after the reset": after_reset,
                               "sessions after POST /users/{id}/logout": len(sessions()), "asked to sign in again after logout": after_logout_asks_password}
    u.context.close()
    # 2. Two OTP credentials, one deleted.
    fresh(["Alex's phone", "Alex's tablet"])
    labels = [c.get("userLabel") for c in otps()]
    lost = [c for c in otps() if c.get("userLabel") == "Alex's phone"][0]
    api(f"/users/{uid()}/credentials/{lost['id']}", "DELETE")
    u = user_signin(b, "two")
    res["two OTP credentials, one deleted"] = {"labels before": labels, "left": [c.get("userLabel") for c in otps()],
        "asks for a code": u.locator("#otp").count() > 0, "asks to set up an authenticator": u.locator("#kc-totp-secret-key, #mode-manual, #totp").count() > 0,
        "lets the user choose the device": u.locator("[name=selectedCredentialId], .pf-v5-c-tile, #kc-otp-credential-0").count() > 0}
    u.context.close()
    fresh(["Alex's new phone"]); set_actions([])
    b.close()
print(json.dumps(res, indent=1))
pathlib.Path(__file__).with_name("sessions.json").write_text(json.dumps(res, indent=1))
