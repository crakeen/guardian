"""Convierte la hoja "Registro" del Excel de forward test en un archivo que la app puede importar.

Uso: python3 scripts/excel_to_json.py Registro.xlsx salida.json
Columnas esperadas desde la fila 9: Nº | Fecha | Activo | R obtenido | Setup completo | Ventana | Nota.
Sin dependencias: lee el .xlsx (que es un zip de XML) con la librería estándar.
"""
import html
import json
import re
import sys
import zipfile
from datetime import date, timedelta
from pathlib import Path


def cells(xlsx: Path):
    z = zipfile.ZipFile(xlsx)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in re.findall(r"<si>(.*?)</si>", z.read("xl/sharedStrings.xml").decode(), re.S):
            shared.append(html.unescape("".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S))))
    sheet = z.read("xl/worksheets/sheet1.xml").decode()
    for rn, row in re.findall(r'<row [^>]*r="(\d+)"[^>]*>(.*?)</row>', sheet, re.S):
        out = {}
        for ref, attr, body in re.findall(r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)', row, re.S):
            v = re.search(r"<v>(.*?)</v>", body or "")
            if not v:
                continue
            val = v.group(1)
            out[ref] = shared[int(val)] if 't="s"' in attr else val
        yield int(rn), out


def main(src: Path, dst: Path) -> None:
    trades = []
    for rn, c in cells(src):
        if rn < 9 or "D" not in c or "C" not in c:
            continue
        try:
            r = float(c["D"])
        except ValueError:
            continue
        d = None
        if c.get("B", "").replace(".", "").isdigit():
            d = (date(1899, 12, 30) + timedelta(days=int(float(c["B"])))).isoformat()
        trades.append({
            "id": f"xl-{c.get('A', rn)}",
            "date": d,
            "asset": c["C"].strip().upper(),
            "r": r,
            "status": "closed",
            "checklistOk": c.get("E", "").strip().lower() in ("sí", "si"),
            "outOfPlan": False,
            "window": c.get("F") or None,
            "note": c.get("G", ""),
            "riskUSD": 25,
            "closedAt": f"{d}T12:00:00" if d else None,
            "source": "excel",
        })
    dst.write_text(json.dumps({"trades": trades}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(trades)} operaciones exportadas a {dst}")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
