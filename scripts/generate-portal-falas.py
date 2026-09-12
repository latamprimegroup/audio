#!/usr/bin/env python3
"""Gera os MP3 de fala (edge-tts) para o mixer do portal Google Ads."""
import asyncio
import json
import os
import sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "data", "googleads-portal", "falas.json")
SAIDA = os.path.join(ROOT, "data", "googleads-portal", "falas")


async def gerar(texto, voz, destino):
    com = edge_tts.Communicate(texto, voz)
    await com.save(destino)


async def main():
    forcar = "--forcar" in sys.argv
    with open(CONFIG, encoding="utf-8") as fh:
        cfg = json.load(fh)

    vozes = cfg["vozes"]
    os.makedirs(SAIDA, exist_ok=True)

    for fala in cfg["falas"]:
        destino = os.path.join(SAIDA, fala["id"] + ".mp3")
        if os.path.exists(destino) and not forcar:
            print("  pula  %s (ja existe)" % fala["id"])
            continue
        voz = vozes[fala["idioma"]]
        print(
            "  gera  %s  [%s]  %d chars ..." % (fala["id"], voz, len(fala["texto"])),
            end="",
            flush=True,
        )
        await gerar(fala["texto"], voz, destino)
        print(" %d KB" % (os.path.getsize(destino) // 1024))

    print("pronto em %s" % SAIDA)


if __name__ == "__main__":
    asyncio.run(main())
