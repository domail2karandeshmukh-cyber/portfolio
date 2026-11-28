"""Checks the order of the two admin actions of an OTP reset, on Keycloak 26.8.2 running on this computer.
A: delete the OTP credential, then add Configure OTP (the guide's order until 28 November 2026).
B: add Configure OTP first, then delete the OTP credential (the revised order).
For each, it signs in as the user at the moment between the two actions and records what Keycloak asks for."""
import json, sys
from playwright.sync_api import sync_playwright
src = open(__file__.replace("verify-order.py", "capture.py")).read().split("with sync_playwright() as p:")[0]
src = src.replace("OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)", "OUT = Path('/tmp')")
ns = {}; exec(src, ns)
api, uid, user_signin, enroll = ns["api"], ns["uid"], ns["user_signin"], ns["enroll"]

def otp_ids(): return [c["id"] for c in api(f"/users/{uid()}/credentials") if c["type"] == "otp"]
def set_actions(acts):
    u = api(f"/users/{uid()}"); u["requiredActions"] = acts; api(f"/users/{uid()}", "PUT", u)
def actions(): return api(f"/users/{uid()}").get("requiredActions", [])
def what_it_asks(b):
    u = user_signin(b, "probe")
    r = {"asks_for_code": u.locator("#otp").count() > 0,
         "asks_to_set_up_authenticator": u.locator("#kc-totp-secret-key, #mode-manual, #totp").count() > 0,
         "signed_in_with_password_alone": "/account" in u.url and u.locator("#otp, #totp, #mode-manual").count() == 0}
    u.context.close(); return r

res = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    def fresh(label):
        for i in otp_ids(): api(f"/users/{uid()}/credentials/{i}", "DELETE")
        set_actions(["CONFIGURE_TOTP"]); enroll(b, label)
        assert otp_ids() and "CONFIGURE_TOTP" not in actions()
    fresh("Alex's phone")
    for i in otp_ids(): api(f"/users/{uid()}/credentials/{i}", "DELETE")
    res["A: after deleting, before adding Configure OTP"] = what_it_asks(b)
    fresh("Alex's phone")
    set_actions(sorted(set(actions()) | {"CONFIGURE_TOTP"}))
    res["B: after adding Configure OTP, before deleting"] = what_it_asks(b)
    for i in otp_ids(): api(f"/users/{uid()}/credentials/{i}", "DELETE")
    res["B: after both actions"] = what_it_asks(b)
    fresh("Alex's new phone")
    b.close()
print(json.dumps(res, indent=1))
json.dump(res, open("/home/claude/v101/kc-capture/order.json", "w"), indent=1)
