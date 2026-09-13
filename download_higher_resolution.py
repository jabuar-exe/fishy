from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from urllib.request import Request, urlopen
import json, sys
import ssl

root = Path(sys.argv[1])
selected = Path(sys.argv[2])
output = Path(sys.argv[3])
output.mkdir(parents=True, exist_ok=True)

urls = {}
for manifest in root.rglob('manifest.json'):
    try:
        data = json.loads(manifest.read_text())
    except Exception:
        continue
    for item in data.get('assets', []):
        urls[item.get('id')] = item.get('url')

downloaded = 0
missing = []
for path in selected.iterdir():
    if path.suffix.lower() not in {'.jpg', '.jpeg', '.png', '.webp'}:
        continue
    url = urls.get(path.stem)
    if not url:
        missing.append(path.name)
        continue
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k != 'ctp']
    high_url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    req = Request(high_url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urlopen(req, timeout=30, context=ssl._create_unverified_context()) as response:
            (output / path.name).write_bytes(response.read())
        downloaded += 1
    except Exception as exc:
        print(f'failed {path.name}: {exc}')
print(json.dumps({'downloaded': downloaded, 'missing_manifest_url': len(missing), 'missing': missing}, indent=2))
