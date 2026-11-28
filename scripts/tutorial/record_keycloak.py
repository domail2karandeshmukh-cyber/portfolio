"""Records the Keycloak tutorial "Reset a user's OTP credential", in the tested order (sign out, require, delete): a Keycloak 26.8.2 server running on this computer,
driven through the real task in Google Chrome, and filmed with the DevTools screencast, frame by frame as the page
paints. The pointer, its click rings, the green marks and the redaction are drawn in the page (overlay.js), so what
the film shows is what the browser showed.

    KEYCLOAK_SECRETS=<folder> python3 scripts/tutorial/record_keycloak.py <work folder>

The folder holds docs-admin-pass.txt (the master-realm administrator sam.rivera) and user-pass.txt (alex.morgan in the
realm portfolio-demo). The passwords are typed into password fields, which show dots, and appear nowhere in the output.
Writes <work>/frames/<scene>/<n>.jpg and <work>/recording.json: each scene's frames with their times, and the beats
(the moments an action starts) that the film times to the narration. Needs Python with Playwright, and Google Chrome.
"""
import asyncio, base64, hashlib, hmac, json, os, pathlib, struct, sys, time, urllib.parse, urllib.request
from playwright.async_api import async_playwright

KC, REALM, USER = "http://127.0.0.1:8180", "portfolio-demo", "alex.morgan"
WORK = pathlib.Path(sys.argv[1]); (WORK / "frames").mkdir(parents=True, exist_ok=True)
SECRETS = pathlib.Path(os.environ.get("KEYCLOAK_SECRETS", ""))
APW, UPW = (SECRETS / "docs-admin-pass.txt").read_text().strip(), (SECRETS / "user-pass.txt").read_text().strip()
VIEW, SCALE = {"width": 1280, "height": 672}, 1.5          # 1920 x 1008 pixels: the film adds a 72-pixel band above
OVERLAY = (pathlib.Path(__file__).parent / "overlay.js").read_text()
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
log = {"keycloak": "26.8.2", "recorded": time.strftime("%Y-%m-%d"), "viewport": VIEW, "scale": SCALE, "scenes": []}


def totp(secret):
    """The code an authenticator app shows now, from the secret in the setup page's hidden field (its raw characters, not Base32)."""
    h = hmac.new(secret.encode(), struct.pack(">Q", int(time.time() // 30)), hashlib.sha1).digest(); o = h[-1] & 15
    return str((struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF) % 10 ** 6).zfill(6)


def api(path, method="GET", body=None):
    tok = json.loads(urllib.request.urlopen(urllib.request.Request(f"{KC}/realms/master/protocol/openid-connect/token", data=urllib.parse.urlencode(
        {"grant_type": "password", "client_id": "admin-cli", "username": "sam.rivera", "password": APW}).encode())).read())["access_token"]
    req = urllib.request.Request(f"{KC}/admin/realms/{REALM}{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    raw = urllib.request.urlopen(req).read()
    return json.loads(raw) if raw else None


def uid():
    return api(f"/users?username={USER}&exact=true")[0]["id"]


class Camera:
    """The DevTools screencast of one page: every frame it paints, with the time it was painted."""

    def __init__(self, page):
        self.page, self.scene, self.frames, self.n = page, None, [], 0

    async def start(self):
        self.cdp = await self.page.context.new_cdp_session(self.page)
        self.cdp.on("Page.screencastFrame", lambda p: asyncio.ensure_future(self.keep(p)))
        await self.cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": 1920, "maxHeight": 1008, "everyNthFrame": 1})

    async def keep(self, p):
        try: await self.cdp.send("Page.screencastFrameAck", {"sessionId": p["sessionId"]})
        except Exception: pass
        if not self.scene: return
        self.n += 1
        path = WORK / "frames" / self.scene / f"{self.n:05d}.jpg"
        path.write_bytes(base64.b64decode(p["data"]))
        self.frames.append([p["metadata"]["timestamp"], str(path.relative_to(WORK))])

    async def stop(self):
        await self.cdp.send("Page.stopScreencast")


class Director:
    """Acts on a page the way a person would: the pointer goes to a control, its mark appears, the click lands."""

    def __init__(self, page, camera):
        self.page, self.cam, self.beats, self.at = page, camera, [], (640, 340)

    async def ov(self, expr, *args):
        await self.page.evaluate("a => window.__ov && window.__ov." + expr, list(args))

    async def ensure(self):
        await self.page.evaluate("() => window.__ov && window.__ov.install()")
        await self.ov("pointer(a[0], a[1])", *self.at)

    async def box(self, sel):
        loc = self.page.locator(sel).first
        await loc.wait_for(state="visible", timeout=15000)
        b = await loc.bounding_box()
        assert b, "no box for " + sel
        return b

    def beat(self, name):
        self.beats.append({"scene": self.cam.scene, "beat": name, "t": time.time()})

    async def wait(self, ms):
        await self.page.wait_for_timeout(ms)

    async def glide(self, b, dx=0.5, dy=0.5, ms=650):
        x, y = b["x"] + b["width"] * dx, b["y"] + b["height"] * dy
        await self.ov("glide(a[0], a[1], a[2])", x, y, ms); await self.wait(ms + 60); self.at = (x, y)

    async def mark(self, key, b, n=None, side="left"):
        await self.ov("mark(a[0], a[1], a[2], a[3])", key, b, n, side); await self.wait(420)

    async def click(self, sel, b=None):
        b = b or await self.box(sel)
        await self.glide(b)
        await self.ov("ring(a[0], a[1])", *self.at); await self.wait(120)
        await self.page.locator(sel).first.click(); await self.wait(300)

    async def type(self, sel, text, delay=75):
        await self.page.locator(sel).first.type(text, delay=delay)

    async def scene(self, name, act):
        self.cam.scene = name; (WORK / "frames" / name).mkdir(exist_ok=True)
        start, first = time.time(), len(self.cam.frames)
        await self.ensure(); await self.ov("nudge()"); await self.wait(250)   # a first frame for the scene
        await act(self)
        await self.wait(500)
        log["scenes"].append({"scene": name, "start": start, "end": time.time(), "page": self.page.url.replace(KC, ""),
                              "frames": self.cam.frames[first:], "beats": [b for b in self.beats if b["scene"] == name]})
        self.cam.scene = None
        print(f"{name}: {len(self.cam.frames) - first} frames, {time.time() - start:.1f} s", flush=True)


async def main():
    # The starting point: one authenticator, "Alex's phone", no required action, and empty event logs.
    u_id = uid()
    for c in api(f"/users/{u_id}/credentials"):
        if c["type"] == "otp": api(f"/users/{u_id}/credentials/{c['id']}", "DELETE")
    user = api(f"/users/{u_id}"); user["requiredActions"] = ["CONFIGURE_TOTP"]; api(f"/users/{u_id}", "PUT", user)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"])
        # Enrolment of the first phone, off camera.
        s = await (await b.new_context(viewport={"width": 1280, "height": 800})).new_page()
        await s.goto(f"{KC}/realms/{REALM}/account", wait_until="networkidle")
        await s.fill("#username", USER); await s.fill("#password", UPW); await s.click("#kc-login"); await s.wait_for_load_state("networkidle")
        secret = await s.input_value("#totpSecret")
        await s.fill("#totp", totp(secret)); await s.fill("#userLabel", "Alex's phone"); await s.click("#saveTOTPBtn"); await s.wait_for_load_state("networkidle")
        # The session stays open, as it would on the lost phone: the Sessions tab then has one to sign out.
        user = api(f"/users/{u_id}"); assert not user.get("requiredActions"), user.get("requiredActions")
        assert len(api(f"/users/{u_id}/sessions")) >= 1
        api("/admin-events", "DELETE"); api("/events", "DELETE")

        ctx = await b.new_context(viewport=VIEW, device_scale_factor=SCALE, locale="en-US", color_scheme="light")
        await ctx.add_init_script(OVERLAY)
        a = await ctx.new_page()
        await a.goto(KC + "/admin/master/console/", wait_until="networkidle")
        await a.fill("#username", "sam.rivera"); await a.fill("#password", APW); await a.click("#kc-login"); await a.wait_for_load_state("networkidle")
        await a.goto(f"{KC}/admin/master/console/#/{REALM}", wait_until="networkidle"); await a.reload(wait_until="networkidle"); await a.wait_for_timeout(2500)
        cam = Camera(a); await cam.start()
        d = Director(a, cam)

        async def find(d):
            realm = await a.evaluate("""() => { const leaf = (txt) => [...document.querySelectorAll('nav *')].find(e => e.children.length === 0 && e.textContent.trim() === txt);
                const rs = [leaf('Portfolio demonstration'), leaf('Current realm')].filter(Boolean).map(e => e.getBoundingClientRect());
                const x = Math.min(...rs.map(r => r.left)), y = Math.min(...rs.map(r => r.top)), r2 = Math.max(...rs.map(r => r.right)), b2 = Math.max(...rs.map(r => r.bottom));
                return { x, y, width: r2 - x, height: b2 - y }; }""")
            d.beat("realm"); await d.glide(realm, 1.06, 0.8); await d.mark("realm", realm); await d.wait(900)
            d.beat("users"); await d.ov("unmark('realm')"); await d.click("nav a:has-text('Users')"); await d.wait(1600); await d.ensure()
            box = await d.box("input[placeholder='Search user']")
            d.beat("search"); await d.mark("search", box); await d.click("input[placeholder='Search user']", box)
            await d.type("input[placeholder='Search user']", USER); await a.keyboard.press("Enter"); await d.wait(1300)
            link = await d.box(f"table a:has-text('{USER}')")
            d.beat("username"); await d.mark("user", link, 1, "right"); await d.wait(300)
            await d.ov("clear()"); await d.click(f"table a:has-text('{USER}')", link); await d.wait(1800); await d.ensure()
        await d.scene("find", find)

        async def sessions(d):
            await d.ov("clear()")
            tab = await d.box("[role=tab]:has-text('Sessions')")
            d.beat("tab"); await d.mark("tab", tab, 1, "above"); await d.click("[role=tab]:has-text('Sessions')", tab); await d.wait(1500); await d.ensure()
            await d.ov("clear()")
            btn = await d.box("button:has-text('Logout all sessions')")
            d.beat("logout"); await d.mark("logout", btn, 2, "right"); await d.wait(300); await d.ov("clear()")
            await d.click("button:has-text('Logout all sessions')", btn); await d.wait(900); await d.ensure()
            ok = await d.box("[role=dialog] button:has-text('Confirm')")
            d.beat("confirm"); await d.mark("ok", ok, 3); await d.wait(250); await d.ov("clear()")
            await d.click("[role=dialog] button:has-text('Confirm')", ok); await d.wait(1600); await d.ensure()
        await d.scene("sessions", sessions)

        async def require(d):
            await d.ov("clear()")
            d.beat("details"); await d.click("[data-testid=user-details-tab]"); await d.wait(1400); await d.ensure()
            field = "input[placeholder='Select action']"
            d.beat("select"); await d.click(field); await d.wait(700); await d.ensure()
            await d.click("[role=option]:has-text('Configure OTP')"); await d.wait(500)
            await a.keyboard.press("Escape"); await d.wait(400); await d.ensure()
            fbox = await a.evaluate("""s => { const i = document.querySelector(s); const t = i.closest('[class*=menu-toggle]') || i.parentElement; const r = t.getBoundingClientRect();
                return { x: r.x, y: r.y, width: r.width, height: r.height }; }""", field)
            await d.mark("field", fbox, 1, "above")
            save = await d.box("[data-testid=user-creation-save]")
            d.beat("save"); await d.mark("save", save, 2); await d.click("[data-testid=user-creation-save]", save); await d.wait(1600)
        await d.scene("require", require)

        otp_row = "table tbody tr:has-text('Otp')"
        async def credentials(d):
            await d.ov("clear()")
            tab = await d.box("[data-testid=credentials]")
            d.beat("tab"); await d.mark("tab", tab, 1, "above"); await d.click("[data-testid=credentials]", tab); await d.wait(1500); await d.ensure()
            await d.ov("clear()")
            row = await d.box(otp_row)
            d.beat("row"); await d.mark("row", row, 2); await d.glide(await d.box(f"{otp_row} td:nth-child(3)"), 0.92, 0.85, 700)
        await d.scene("credentials", credentials)

        async def delete(d):
            await d.ov("clear()")
            d.beat("kebab"); await d.click(f"{otp_row} button[aria-label='Kebab toggle']"); await d.wait(600); await d.ensure()
            item = await d.box("[role=menuitem]:has-text('Delete')")
            d.beat("delete"); await d.mark("item", item, 1); await d.wait(250); await d.ov("clear()")
            await d.click("[role=menuitem]:has-text('Delete')", item); await d.wait(900); await d.ensure()
        await d.scene("delete", delete)

        async def confirm(d):
            btn = await d.box("[role=dialog] button:has-text('Delete')")
            d.beat("confirm"); await d.mark("confirm", btn, 1); await d.wait(250); await d.ov("clear()")
            await d.click("[role=dialog] button:has-text('Delete')", btn); await d.wait(1500); await d.ensure()
            d.beat("left"); await d.mark("table", await d.box("table tbody"))
        await d.scene("confirm", confirm)
        await d.ov("clear()")
        log["after_admin_steps"] = {"sessions": len(api(f"/users/{u_id}/sessions")), "required_actions": api(f"/users/{u_id}").get("requiredActions"),
                                    "credentials": [c["type"] for c in api(f"/users/{u_id}/credentials")]}

        # The user's own browser: a second window, filmed by its own camera.
        uctx = await b.new_context(viewport=VIEW, device_scale_factor=SCALE, locale="en-US", color_scheme="light")
        await uctx.add_init_script(OVERLAY)
        u = await uctx.new_page()
        await u.goto(f"{KC}/realms/{REALM}/account", wait_until="networkidle"); await u.wait_for_timeout(1200)
        ucam = Camera(u); await ucam.start()
        e = Director(u, ucam); e.beats = d.beats

        async def user(e):
            e.beat("signin")
            await e.click("#username"); await e.type("#username", USER, 60)
            await e.click("#password"); await e.type("#password", UPW, 45)
            await e.click("#kc-login"); await u.wait_for_load_state("networkidle"); await e.wait(1200); await e.ensure()
            qr = await e.box("#kc-totp-secret-qr-code")
            await e.ov("redact(a[0], a[1], a[2])", "qr", qr, "QR code hidden in this video")
            e.beat("scan"); await e.wait(900)
            await u.evaluate("() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })"); await e.wait(1100)
            e.beat("code"); code = await e.box("#totp"); await e.mark("code", code, 1)
            await e.click("#totp", code); await e.type("#totp", totp(await u.input_value("#totpSecret")), 110)
            lab = await e.box("#userLabel")
            e.beat("label"); await e.mark("label", lab, 2); await e.click("#userLabel", lab); await e.type("#userLabel", "Alex's new phone", 55)
            sub = await e.box("#saveTOTPBtn")
            e.beat("submit"); await e.mark("submit", sub, 3); await e.click("#saveTOTPBtn", sub)
            await u.wait_for_load_state("networkidle"); await e.wait(2200); await e.ensure()
        await e.scene("user", user)
        await ucam.stop()
        log["enrolled"] = {"url": u.url.replace(KC, ""), "title": await u.title()}
        await uctx.close()

        # Off camera: the admin console still shows the table from before the user's setup, so load it again.
        await a.goto(f"{KC}/admin/master/console/#/{REALM}/users/{u_id}/settings", wait_until="networkidle"); await a.wait_for_timeout(2500)
        async def verify(d):
            await d.ensure()
            d.beat("tab"); await d.click("[data-testid=credentials]"); await d.wait(1600); await d.ensure()
            row = await d.box(otp_row)
            await d.mark("row", row, 1); await d.wait(1200)
            await d.ov("clear()")
            d.beat("events"); await d.click("nav a:has-text('Events')"); await d.wait(1600); await d.ensure()
            await d.click("[data-testid=admin-events-tab]"); await d.wait(1600); await d.ensure()
            act = await d.box("table tbody tr:has-text('ACTION')")
            await d.mark("event", act, 1); await d.glide(act, 0.75, 0.5, 600)
        await d.scene("verify", verify)
        await cam.stop()
        await s.context.close()
        await b.close()
    log["credentials_after"] = [{"type": c["type"], "label": c.get("userLabel")} for c in api(f"/users/{uid()}/credentials")]
    log["admin_events"] = [{"operation": x["operationType"], "resource": x["resourceType"]} for x in api("/admin-events?max=10")]
    (WORK / "recording.json").write_text(json.dumps(log, indent=1))
    print(json.dumps({k: log[k] for k in ("credentials_after", "admin_events", "enrolled")}, indent=1))

asyncio.run(main())
