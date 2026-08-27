"""E2E: tenant slug link loads the right tenant + its enabled companies.

Run: python3 tests/e2e/tenant-storefront.spec.py  (dev server on :8080)
"""
import asyncio, sys
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
SLUG = "kadis-data"
EXPECTED_PROVIDERS = ["Hormuud", "Somnet", "Somtel", "Amtel"]

results = []
def check(name, ok, detail=""):
    results.append((name, ok, detail))

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

        # 1. valid tenant slug
        await page.goto(f"{BASE}/?t={SLUG}", wait_until="domcontentloaded")
        await page.wait_for_timeout(6000)
        body = await page.inner_text("body")
        check("tenant slug link renders (no infinite spinner)", len(body.strip()) > 0, body[:80])
        check("no 'Shirkad lama helin' empty state", "lama helin" not in body.lower(), body[:200])
        for name in EXPECTED_PROVIDERS:
            check(f"provider '{name}' visible", name.lower() in body.lower())
        check("tenant name shown", "kadis" in body.lower())
        check("no render-loop error", not any("Maximum update depth" in e for e in errors),
              next((e for e in errors if "Maximum update depth" in e), ""))
        await page.screenshot(path="/tmp/browser/tenant/valid.png")

        # 2. unknown slug -> explicit error, not a spinner
        page2 = await ctx.new_page()
        await page2.goto(f"{BASE}/?t=no-such-tenant-xyz", wait_until="domcontentloaded")
        await page2.wait_for_timeout(6000)
        body2 = await page2.inner_text("body")
        check("unknown slug shows an error, not a blank spinner", len(body2.strip()) > 20, body2[:200])
        check("unknown slug does not leak another tenant's data", "kadis" not in body2.lower(), body2[:200])
        await page2.screenshot(path="/tmp/browser/tenant/unknown.png")

        await browser.close()

asyncio.run(main())
failed = 0
for name, ok, detail in results:
    print(("PASS  " if ok else "FAIL  ") + name + (f"   [{detail}]" if not ok and detail else ""))
    failed += 0 if ok else 1
print(f"\n{len(results)-failed}/{len(results)} passed")
sys.exit(1 if failed else 0)
