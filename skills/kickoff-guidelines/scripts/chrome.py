"""Headless Chrome helpers shared by build.py, shoot.py and prep_logos.py."""
import re
import shutil
import subprocess
import zlib
from pathlib import Path

CHROME_PATHS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
]


def find_chrome():
    for path in CHROME_PATHS:
        if Path(path).exists():
            return path
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"):
        if shutil.which(name):
            return shutil.which(name)
    return None


def run(chrome, *args, url):
    return subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                           "--allow-file-access-from-files", *args, url],
                          capture_output=True, text=True)


def dump_dom(chrome, url, budget=4000):
    return run(chrome, f"--virtual-time-budget={budget}", "--dump-dom", url=url).stdout


def print_pdf(chrome, html_path, pdf_path, budget=15000):
    pdf_path.unlink(missing_ok=True)
    run(chrome, "--no-pdf-header-footer", f"--virtual-time-budget={budget}",
        f"--print-to-pdf={pdf_path}", url=Path(html_path).resolve().as_uri())
    return pdf_path.exists()


def pdf_page_count(pdf_path):
    """Pages in a Chrome-printed PDF: page objects, or the page tree's /Count when compressed."""
    data = Path(pdf_path).read_bytes()
    pages = len(re.findall(rb"/Type\s*/Page(?![a-zA-Z])", data))
    if pages:
        return pages
    counts = [int(c) for c in re.findall(rb"/Type\s*/Pages\b[^>]*?/Count\s+(\d+)", data)]
    for m in re.finditer(rb"stream\r?\n", data):
        end = data.find(b"endstream", m.end())
        try:
            body = zlib.decompress(data[m.end():end])
        except zlib.error:
            continue
        pages += len(re.findall(rb"/Type\s*/Page(?![a-zA-Z])", body))
        counts += [int(c) for c in re.findall(rb"/Count\s+(\d+)", body)]
    return pages or max(counts, default=0)
