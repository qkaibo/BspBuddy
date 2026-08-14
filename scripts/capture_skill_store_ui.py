"""Capture BspBuddy Skill Store screenshots via CDP (no puppeteer)."""
from __future__ import annotations

import base64
import json
import sys
import time
import urllib.request
from pathlib import Path

try:
    import websocket  # websocket-client
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "websocket-client", "-q"])
    import websocket


OUT = Path(__file__).resolve().parent


def cdp_pages():
    with urllib.request.urlopen("http://127.0.0.1:9222/json/list", timeout=5) as resp:
        return json.loads(resp.read().decode("utf-8"))


class Cdp:
    def __init__(self, ws_url: str):
        self.ws = websocket.create_connection(ws_url, timeout=60)
        self.ws.settimeout(60)
        self._id = 0

    def call(self, method: str, params: dict | None = None, timeout: float = 60.0):
        self._id += 1
        msg_id = self._id
        self.ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
        deadline = time.time() + timeout
        while time.time() < deadline:
            raw = self.ws.recv()
            data = json.loads(raw)
            if data.get("id") == msg_id:
                if "error" in data:
                    raise RuntimeError(data["error"])
                return data.get("result", {})
        raise TimeoutError(method)

    def close(self):
        self.ws.close()


CLICK_JS = r"""
(() => {
  const want = %s;
  const exact = %s;
  const nodes = [...document.querySelectorAll('button, a, [role="button"], span, div')];
  const el = nodes.find((n) => {
    const s = (n.textContent || '').replace(/\s+/g, ' ').trim();
    return exact ? s === want : s.includes(want);
  });
  if (!el) return { ok: false };
  el.click();
  return { ok: true, text: (el.textContent || '').trim().slice(0, 80) };
})()
"""


def click(cdp: Cdp, text: str, exact: bool = False):
    expr = CLICK_JS % (json.dumps(text), "true" if exact else "false")
    res = cdp.call("Runtime.evaluate", {"expression": expr, "returnByValue": True})
    return res.get("result", {}).get("value")


def body_text(cdp: Cdp) -> str:
    res = cdp.call(
        "Runtime.evaluate",
        {"expression": "document.body.innerText.slice(0, 3000)", "returnByValue": True},
    )
    return res.get("result", {}).get("value") or ""


def screenshot(cdp: Cdp, path: Path):
    res = cdp.call(
        "Page.captureScreenshot",
        {"format": "png", "fromSurface": True, "captureBeyondViewport": False},
        timeout=90.0,
    )
    path.write_bytes(base64.b64decode(res["data"]))
    print("saved", path, path.stat().st_size)


def main() -> None:
    pages = cdp_pages()
    target = next((p for p in pages if "5173" in p.get("url", "")), None)
    if not target:
        raise SystemExit(f"no renderer page: {pages}")
    print("target", target["title"], target["url"])
    cdp = Cdp(target["webSocketDebuggerUrl"])
    try:
        cdp.call("Page.enable")
        cdp.call("Runtime.enable")
        # Close docked DevTools if open so screenshots show the product UI
        cdp.call(
            "Runtime.evaluate",
            {
                "expression": "typeof require!=='undefined'",
                "returnByValue": True,
            },
        )
        try:
            cdp.call("Page.bringToFront")
        except Exception:
            pass
        # Keyboard shortcut won't work easily; resize viewport to content
        cdp.call(
            "Emulation.setDeviceMetricsOverride",
            {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False},
        )
        time.sleep(0.8)
        print("click parent", click(cdp, "专家·技能·连接器"))
        time.sleep(0.5)
        print("click plugins", click(cdp, "技能与插件", exact=True) or click(cdp, "技能与插件"))
        time.sleep(1.0)
        print("click store", click(cdp, "技能商店", exact=True) or click(cdp, "技能商店"))
        time.sleep(1.8)
        print("BODY:\n", body_text(cdp))
        screenshot(cdp, OUT / "ui-skill-store-browse.png")

        card_count = cdp.call(
            "Runtime.evaluate",
            {
                "expression": "(() => { const c=[...document.querySelectorAll('[data-skill-card]')]; if(c[0]) c[0].click(); return c.length; })()",
                "returnByValue": True,
            },
        )
        print("cards", card_count)
        time.sleep(1.0)
        # Prefer JPEG for faster CDP capture
        res = cdp.call(
            "Page.captureScreenshot",
            {"format": "jpeg", "quality": 70, "fromSurface": True},
            timeout=90.0,
        )
        jpeg_path = OUT / "ui-skill-store-detail.jpg"
        jpeg_path.write_bytes(base64.b64decode(res["data"]))
        print("saved", jpeg_path, jpeg_path.stat().st_size)

        # approvals tab — close drawer first
        cdp.call(
            "Runtime.evaluate",
            {
                "expression": "(() => { const x=document.querySelector('[aria-label=\"关闭\"]'); if(x) x.click(); return !!x; })()",
                "returnByValue": True,
            },
        )
        time.sleep(0.4)
        print("approvals", click(cdp, "审批", exact=True) or click(cdp, "授权审批"))
        time.sleep(1.0)
        res = cdp.call(
            "Page.captureScreenshot",
            {"format": "jpeg", "quality": 70, "fromSurface": True},
            timeout=90.0,
        )
        jpeg_path = OUT / "ui-skill-store-approvals.jpg"
        jpeg_path.write_bytes(base64.b64decode(res["data"]))
        print("saved", jpeg_path, jpeg_path.stat().st_size)
    finally:
        cdp.close()


if __name__ == "__main__":
    main()
