# Anno 117 City Planner (lokal)

Lokale Web-App für Stadtplanung mit Raster-Editor.

## Starten

Ohne Build-Schritt (reines HTML/JS):

```bash
python3 -m http.server 5173
```

Dann öffnen: `http://localhost:5173`

## Enthaltene Features

- Toolbar: Platzieren, Kopieren (Pipette + Bereich), Löschen (Einzel/Bereich), Drehen, Zentrieren.
- Linkes Menü mit Gruppen:
  - Straßen (3 Typen)
  - Wohngebäude (4 Typen)
  - Öffentliche Gebäude (~12, Filter)
  - Produktionsgebäude (~40, Filter)
- Editor:
  - Zoom (Mausrad), Pan (rechte Maustaste halten + ziehen)
  - Straßen ziehen per Start-/Endklick, Vorschau während Ziehen
  - Strg+Klick auf Straße: einzelnes Straßenfeld
  - Kürzester Weg um Gebäude herum
  - Gebäude mit Rotation, Kollisionsprüfung
  - Vorschau für Reichweite entlang Straßen + Radius
- Auswahl einzelner Gebäude mit Info-Karte rechts (inkl. Zurück/Abwahl)
- Statistiken unten (inkl. Einkommen und Bevölkerung)
- Import/Export als JSON
- Export der aktuellen Karte als PNG
