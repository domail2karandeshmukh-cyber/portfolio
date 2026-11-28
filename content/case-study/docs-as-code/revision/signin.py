# Sign in as the test user after the REST reset and report what Keycloak shows: the record for the guide's check.
import json
from playwright.sync_api import sync_playwright
pw = open("/home/claude/v101/keycloak/user-pass.txt").read().strip()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"]); pg = b.new_page()
    pg.goto("http://127.0.0.1:8180/realms/portfolio-demo/account"); pg.wait_for_load_state("networkidle")
    pg.fill("#username", "alex.morgan"); pg.fill("#password", pw); pg.click("#kc-login"); pg.wait_for_load_state("networkidle")
    h1 = lambda: pg.locator("h1").first.inner_text() if pg.locator("h1").count() else ""
    seen = [h1()]
    # Required actions run one after another: a pending profile update comes first, then the authenticator setup.
    if seen[-1] == "Update Account Information":
        pg.click("input[type=submit], button[type=submit]"); pg.wait_for_load_state("networkidle"); seen.append(h1())
    print(json.dumps({"after_password": seen, "asks_for_otp_setup": "Mobile Authenticator Setup" in " ".join(seen)}))
    b.close()
