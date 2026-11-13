# LexiKit (Spektron)

**Themensuche über die fertigen Word-Berichte des Büros** – „Wie haben wir das früher gemacht?“. Für alle, die ein altes
Vorgehen nachsehen wollen, ohne jemanden fragen zu müssen. Läuft im Browser (Edge/Chrome), ohne Server, ohne KI, ohne Netz.

Adresse: `https://kaspersebastian83-dot.github.io/lexikit/` (GitHub Pages muss für dieses Repo eingeschaltet sein).
Gleiche Adresse wie die anderen Apps → LexiKit nimmt den Archivordner, den die Projektzentrale gewählt hat
(Browser-Speicher `mosaik-suite`, Schlüssel `archiv`, nur gelesen). Eine eigene Wahl steht unter `lexikit-archiv`.

Plan und Entscheidungen: Projekt-Doc `claude/lexikit-plan.md`, Stand: `claude/lexikit-stand.md`.

## Was gelesen wird

- **Nur Projektordner direkt im Archivordner** (`26.0137 …`, `22.00114 …`). `ALT_2022`, `ALT_2023`, `Div Kunden`, `Sonstige`,
  `Standard`, `Test` und `_…`-Ordner bleiben draußen.
- **Bericht** = `.docx`, Name enthält „Mitteilung“ (auch Tippfehler wie „Mitteillung“), irgendwo im Projektordner (bis 4 Ebenen,
  ohne `_Spektron`). Nicht: jede Schreibweise von „Anschreiben“, `_Entwurf`, „Vorbereitung“/„Vorlage“, `~$`-Sperrdateien,
  `Gutachten_<Zeitstempel>.docx`, PDF, alte `.doc`.
- **Nur die neueste Fassung je Mitteilung** (Dateizeit). Gleich gelten: Korrektur-Wörter (korrigiert, Korrektur), „- Kopie“, „(2)“,
  Leerzeichen/Unterstrich am Ende, Projektnummer im Namen, Ordner `Mitteilungen`, `n. Mitt` und eine Kopie des Projektordners.
  Eigene Berichte bleiben: andere Zusätze (Gebäude A, Englisch, Ergänzung) und Gebäude-Ordner (Altbau/Neubau).
- **Aus der Word-Datei** wird nur `word/document.xml` gelesen: erst das ZIP-Verzeichnis am Dateiende, dann genau dieser Bereich.
  Fotos werden nicht gelesen, auch nicht von der Platte.

## Abschnitte

- Überschriften sind im Büro reiner Text: **kurzer Absatz (unter 90 Zeichen) außerhalb einer Tabelle, ganz unterstrichen oder
  ganz fett**, nach der Zeile „(n. Mitteilung)“. Ohne diese Zeile beginnt der Text nach dem Titel. „Tabelle 1: …“, „Abb. …“ sind keine
  Überschrift. Berichte ohne Überschrift: Treffer ohne Abschnittsnamen.
- **Berichtskopf fällt weg** (Projektnummer, Schaden vom, VN, Risiko, Versicherer, Schaden-Nr., VS-Nr., Zeichen) – auch mit
  Fortsetzungszeilen (Tab am Anfang) und als Tabelle. Alles vor „(n. Mitteilung)“ (Briefkopf, Deckblatt) ebenso.
- Berichtsform (Sanierungsvorschlag, Untersuchungsbericht, …) aus dem Titel (Formatvorlage Titel/Überschrift).
- Tabellenzeilen sind Textstellen („Zelle · Zelle · Zelle“), nie Überschrift. Gelöschter Text (Änderungsverfolgung) und Feldbefehle
  fallen weg, Textfelder zählen einmal.

## Gemeinsame Dateien in `_LexiKit`

Der Ordner `_LexiKit` im Archivordner ist **der einzige Ort, an dem LexiKit schreibt** (Funktion `schreibe`: nur
`lexikit-themen.json` und `lexikit-index-<Jahr>.json`). LexiKit legt den Ordner nicht selbst an.

- **Schreibprobe** beim Start: kleine Datei anlegen, zurücklesen, entfernen. Geht das nicht → rote Zeile, Suche geht in dieser
  Sitzung, gespeichert wird nichts.
- **Index je Jahr** (`lexikit-index-2026.json` …): Pfad → Projekt, Datei, Jahr, Mitteilung, Form, Stempel (Größe, Dateizeit),
  gelesen am, Abschnitte. Mehrere PCs: **vor jedem Schreiben neu lesen und nur die eigenen Änderungen einspielen** (neu/geändert, weg).
  Hat ein anderer PC eine neuere Fassung derselben Datei gelesen, bleibt seine. Unlesbarer Index → wird neu geschrieben (er ist nur
  eine Kopie der Berichte); Index einer neueren LexiKit-Fassung → bleibt unberührt.
- **Themenliste** (`lexikit-themen.json`): Name + Nebenwörter, Datum der letzten Änderung. Gelöschte Themen bleiben als Vermerk,
  damit kein anderer PC sie zurückbringt. Hat ein anderer PC das Thema geändert, seit das Formular aufging → nicht gespeichert, das
  Formular zeigt den neuen Stand. Unlesbare Themenliste wird nie überschrieben.
- Der Index enthält Berichtstext und ist so vertraulich wie die Berichte.

## Einlesen

Erster Start: alles, neueste Jahre zuerst, mit Fortschritt (Projektordner), Suchen geht schon währenddessen. Gespeichert wird nach
jedem Jahr, alle 90 s und bei „Anhalten“. Danach bei jedem Start im Hintergrund: nur Berichte mit anderer Größe oder Dateizeit,
neue, nicht mehr ausgewählte (ersetzt, gelöscht) fallen heraus. „⋯ Mehr“: Neue Berichte suchen · Einlesen ansehen · Alle neu
einlesen · Einstellungen · Über.

## Suche

Themen links (gespeicherte Suche: Name + Nebenwörter, eines muss vorkommen), eigene Suche oben (alle Wörter in der Textstelle,
Wörter aus der Abschnittsüberschrift zählen mit, „…“ hält zusammen), Teile von Wörtern, Groß/Klein egal. Jahr-Filter. Treffer =
Absatz, neueste zuerst (Jahr, Projektnummer, Mitteilung). Knöpfe:

- **Bericht in Word öffnen**: `ms-word:ofv|u|file:///…` aus dem Pfad in den Einstellungen (Standard `C:\Daten\Mosaik Archivordner`,
  je PC) – der Browser kennt den echten Pfad nicht. Der Pfad wird zusätzlich kopiert.
- **Ganzen Abschnitt zeigen**: alle Absätze des Abschnitts, der Fund hinterlegt.
- **Projektordner**: kopiert den Pfad (im Explorer in die Adresszeile einfügen).

## Aufbau

Eine Datei `index.html` (Spektron-Look v1 byte-gleich, Kern-Block `LEXIKIT-KERN` ohne Browserteile, Oberfläche), dazu `sw.js`
(„Netz zuerst“ wie BerichtKit, nur eigene Dateien), `manifest.webmanifest`, `icon.svg`. App-Farbe `#2b6f6a` ist ein Platzhalter.

## Tests

```
node tests/kern.cjs       # Word lesen (erfundene .docx), Abschnitte, Kopf weg, Auswahl, Suche, Zusammenführen
node tests/dateien.cjs    # Spektron-Look gleich wie ../berichtkit, Offline-Dateien, kein Netz
node tests/browser.cjs    # Chromium mit erfundenem Archiv im OPFS (NODE_PATH auf playwright; CHROME=… optional)
```

Testberichte (`tests/daten/berichte.cjs`) sind erfunden – keine echten Berichtstexte, keine Kundennamen.

## Regeln

- Liest nur in den Projektordnern, schreibt nie dorthin. Fügt nichts in Berichte ein.
- Keine KI, kein Netz – Wortsuche im Index.
- Außerhalb der Spektron-Kette (kein Schritt in der Leiste, kein Projektstand).
- Nicht in 0.1.0: PDF, `.doc`, Link aus Projektzentrale/BerichtKit, eigener Filter nach Berichtsart.
