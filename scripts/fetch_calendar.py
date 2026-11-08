"""Descarga el calendario semanal de Forex Factory y guarda solo USD, EUR y GBP de impacto medio o alto.

Lo ejecuta la GitHub Action .github/workflows/calendar.yml. El navegador no puede leer ese feed
directamente (no permite CORS), así que la app lee data/calendar.json desde su propio dominio.
"""
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
KEEP = {"USD", "EUR", "GBP"}


def main(out: Path) -> None:
    req = urllib.request.Request(URL, headers={"User-Agent": "guardian-calendar/1.0"})
    with urllib.request.urlopen(req, timeout=30) as res:
        raw = json.load(res)
    events = [
        {"title": e["title"], "country": e["country"], "date": e["date"], "impact": e["impact"]}
        for e in raw
        if e.get("country") in KEEP and e.get("impact") in ("High", "Medium")
    ]
    data = {"fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "source": "Forex Factory", "events": events}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(events)} noticias guardadas en {out}")


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "data/calendar.json"))
