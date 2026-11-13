# LexiKit (Spektron)

**Frühere Fälle aus den fertigen Word-Berichten des Büros finden** – „Wie haben wir das früher gemacht?“. Für alle, die ein altes
Vorgehen nachsehen wollen, ohne jemanden fragen zu müssen. Läuft im Browser (Edge/Chrome), ohne Server, ohne KI, ohne Netz.
Ab 0.2.0 ist die Einheit der **Fall**: ein Projektordner mit allen seinen Mitteilungen. Ab 0.3.0 lassen sich bis zu drei Fälle
**für ChatGPT kopieren** – LexiKit selbst sendet nichts, man fügt den Text selbst ein.

Adresse: `https://kaspersebastian83-dot.github.io/lexikit/` (GitHub Pages muss für dieses Repo eingeschaltet sein).
Gleiche Adresse wie die anderen Apps → LexiKit nimmt den Archivordner, den die Projektzentrale gewählt hat
(Browser-Speicher `mosaik-suite`, Schlüssel `archiv`, nur gelesen). Eine eigene Wahl steht unter `lexikit-archiv`.

Plan und Entscheidungen: Projekt-Docs `claude/lexikit-plan.md`, `claude/lexikit-stufe2-plan.md`, `claude/lexikit-stufe2-zaehlung.md`,
Stand: `claude/lexikit-stand.md`.

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
- **Berichtskopf fällt weg** (Projektnummer, Schaden vom, VN, Risiko, Versicherer, Schaden-Nr., VS-Nr., Zeichen; ab 0.2.0 auch die
  zweite Kopf-Form Auftraggeber, Schadenort, Bestell-/Auftrags-Nr.) – auch mit Fortsetzungszeilen (Tab am Anfang; vor der ersten
  Überschrift auch bis zu drei kurze Zeilen ohne Satzende, z. B. die Anschrift) und als Tabelle. Alles vor „(n. Mitteilung)“
  (Briefkopf, Deckblatt) ebenso. Eine unterstrichene E-Mail-Adresse ist keine Überschrift und kommt nicht in den Index.
- Berichtsform (Sanierungsvorschlag, Untersuchungsbericht, …) aus dem Titel (Formatvorlage Titel/Überschrift).
- Tabellenzeilen sind Textstellen („Zelle · Zelle · Zelle“), nie Überschrift. Gelöschter Text (Änderungsverfolgung) und Feldbefehle
  fallen weg, Textfelder zählen einmal.

## Gemeinsame Dateien in `_LexiKit`

Der Ordner `_LexiKit` im Archivordner ist **der einzige Ort, an dem LexiKit schreibt** (Funktion `schreibe`: nur
`lexikit-themen.json` und `lexikit-index-<Jahr>.json`). LexiKit legt den Ordner nicht selbst an.

- **Schreibprobe** beim Start: kleine Datei anlegen, zurücklesen, entfernen. Geht das nicht → rote Zeile, Suche geht in dieser
  Sitzung, gespeichert wird nichts.
- **Index je Jahr** (`lexikit-index-2026.json` …): Pfad → Projekt, Datei, Jahr, Mitteilung, Form, Stempel (Größe, Dateizeit),
  gelesen am, Abschnitte. **Fassung 1, in 0.2.0 unverändert** – die Fälle werden bei jedem Start im Speicher daraus gebaut und nie
  gespeichert; für 0.2.0 wird nichts neu eingelesen, 0.1.0 und 0.2.0 können nebeneinander laufen. Mehrere PCs: **vor jedem Schreiben neu lesen und nur die eigenen Änderungen einspielen** (neu/geändert, weg).
  Hat ein anderer PC eine neuere Fassung derselben Datei gelesen, bleibt seine. Unlesbarer Index → wird neu geschrieben (er ist nur
  eine Kopie der Berichte); Index einer neueren LexiKit-Fassung → bleibt unberührt.
- **Themenliste** (`lexikit-themen.json`): Name + Nebenwörter, Gruppe („Themen“ / „Art des Falls“), Datum der letzten Änderung.
  **Fassung 2** (Gruppen). Eine Liste aus 0.1.0 (Fassung 1) hebt 0.2.0 beim Start einmal an: neu lesen, alle Themen und
  Lösch-Vermerke bleiben, dazu die sechs „Art des Falls“, die es noch nicht gibt. LexiKit 0.1.0 fasst eine Liste der Fassung 2
  nicht an (zeigt „bitte LexiKit neu laden“). Gelöschte Themen bleiben als Vermerk,
  damit kein anderer PC sie zurückbringt. Hat ein anderer PC das Thema geändert, seit das Formular aufging → nicht gespeichert, das
  Formular zeigt den neuen Stand. Unlesbare Themenliste wird nie überschrieben.
- Der Index enthält Berichtstext und ist so vertraulich wie die Berichte.

## Einlesen

Erster Start: alles, neueste Jahre zuerst, mit Fortschritt (Projektordner), Suchen geht schon währenddessen. Gespeichert wird nach
jedem Jahr, alle 90 s und bei „Anhalten“. Danach bei jedem Start im Hintergrund: nur Berichte mit anderer Größe oder Dateizeit,
neue, nicht mehr ausgewählte (ersetzt, gelöscht) fallen heraus. „⋯ Mehr“: Neue Berichte suchen · Einlesen ansehen · Alle neu
einlesen · Einstellungen · Über.

## Fälle (ab 0.2.0)

Ein **Fall** ist ein Projektordner mit allen seinen Mitteilungen. Alles Folgende wird aus dem Index abgeleitet (Kern: `ableiten`,
`faelleBauen`), nichts davon gespeichert.

- **Abschnittsklassen** nach Stichwort in der Überschrift (Zählung am echten Archiv, 13.11.2026): Veranlassung (auch
  Aufgabenstellung) · Probenahme (Ortstermin, Besichtigung, Probenahme) · Befund (Befund, Ergebnisse, Mikrobiologie, sensorische
  Prüfung) · Schlussfolgerungen (auch Bewertung, Stellungnahme) · Sanierungsmaßnahmen (Maßnahmen, Sanierung) · Arbeitsschutz.
  Kein „Bewertung“, kein „Entsorgung“. Unbekannte Unterüberschriften („5.1 Wischproben“) bleiben in der Klasse darüber. Die
  **Einleitung ohne Überschrift** vor der ersten bekannten Überschrift (so beginnen kurze Folgeberichte) steht unter
  **Veranlassung**; eine bloße Betreffzeile („Wasserschaden“) zählt nicht. **Weiteres** gibt es nur noch für Berichte ganz ohne
  bekannte Überschrift in einem Fall, der sonst Reiter hat.
- **Was war**: Anfang von Veranlassung oder Aufgabenstellung der ersten Mitteilung (mit Überschrift), sonst der erste Textblock.
- **Untersucht** heißt gemessen, nicht erwähnt: Parameter aus dem Wörterbuch `PARAMETER` zählen nur in Probenahme und Befund (und in
  der Einleitung ohne Überschrift), und nur in einem Satz, der von Probe, Messung oder Ergebnis spricht und nicht sagt, dass es
  unterblieb oder erst empfohlen wird; Tabellenzeilen zählen so. „Nicht nachgewiesen“ ist ein Ergebnis. Berichte ohne
  Überschriften: ganzer Text, gleiche Satzregel. Probenzahlen („zwölf Wischproben“) stehen mit den Parametern desselben Satzes,
  kommen aus der Probenahme (aus dem Befund nur, wenn es keine gibt) und werden nie zusammengezählt. Jedes Schildchen zeigt per
  Klick seine Stelle im Bericht.
- **Verlauf**: Mitteilungen mit Berichtsform. Gebäude-Ordner (Altbau/Neubau) und Gebäude-Zusätze im Namen („Gebäude A“) sind
  eigene **Stränge**; „Was war“ stammt aus dem ersten Strang (Bericht ohne Gebäude zuerst, sonst nach Namen) und nennt ihn.
  **Englische Fassungen** (Dateiname mit „Engl…“) stehen nur im Verlauf – nicht in Suche, Reitern, „Untersucht“.
- Berichte ohne Überschriften: Zusammenfassung und ganzer Text, keine Reiter.

## Suche

Themen links in zwei Gruppen (gespeicherte Suche: Name + Nebenwörter, eines muss vorkommen), oben „Fall in ein paar Worten
beschreiben“ (jedes Wort muss im Text des Falls vorkommen, „…“ hält zusammen) – **beides zusammen geht**; ein Thema noch einmal
antippen wählt es ab. Teile von Wörtern, Groß/Klein egal; **Überschriften zählen nicht**. Filter „Untersucht auf“ (mehrere: alle)
und Jahr. Reihenfolge: Fälle mit den meisten Begriffen in Veranlassung/Aufgabenstellung zuerst (fehlt sie im ganzen Fall, zählt
ersatzweise der „Was war“-Text), Fälle nur mit Fund im Arbeitsschutz zuletzt, sonst neueste zuerst. Themen zeigen die Zahl der Fälle.

Fallkarte: „Fall öffnen“ (erster Reiter mit Fund) und „Maßnahmen zeigen“ (ohne Sanierungsmaßnahmen: „Schlussfolgerungen zeigen“).
Im offenen Fall:

- **Bericht in Word öffnen**: `ms-word:ofv|u|file:///…` aus dem Pfad in den Einstellungen (Standard `C:\Daten\Mosaik Archivordner`,
  je PC) – der Browser kennt den echten Pfad nicht. Der Pfad wird zusätzlich kopiert.
- **Abschnitt kopieren**: der gezeigte Reiter in die Zwischenablage (LexiKit fügt nirgends ein).
- **Projektordner**: kopiert den Pfad (im Explorer in die Adresszeile einfügen).
- **Für ChatGPT kopieren**: öffnet die Vorschau mit diesem Fall (siehe unten).

## Für ChatGPT kopieren (ab 0.3.0)

Auftragsverarbeitungsvertrag mit OpenAI für ChatGPT Business: geklärt (Basti, 13.11.2026). Die Regeln unten gelten trotzdem.

- **Auswählen** an jeder Fallkarte, höchstens 3 Fälle; die Leiste „n Fälle ausgewählt“ öffnet die Vorschau. Die Auswahl bleibt beim
  Weitersuchen stehen und ist nach dem Kopieren leer. Im offenen Fall: „Für ChatGPT kopieren“ mit diesem einen Fall.
- **Nichts ohne Vorschau**: Die Vorschau zeigt genau den Text der Zwischenablage, mit Länge, Zahl der Fälle/Abschnitte und der ersetzten
  Namen. Kopieren geht erst, wenn jede verdächtige Stelle entfernt oder als „ist kein Name“ bestätigt ist.
- **Inhalt**: Prompt (aus `claude/lexikit-stufe2-plan.md`), Frage (Vorlagen: Wortlaut der Maßnahmen · Was wurde gemessen und warum ·
  Vergleich mit meinem Fall · eigene Frage), dann die Auszüge. Angeboten: „Untersucht“ (Zeile der Fallkarte), Befund, Schlussfolgerungen,
  Sanierungsmaßnahmen (angehakt), Arbeitsschutz (nicht angehakt). Je Fall wählbar, welche Mitteilungen (nach Gebäude) mitgehen.
- **Nie kopiert, ohne Wahl**: Veranlassung, Aufgabenstellung, die Einleitung ohne Überschrift, Ortstermin/Probenahme, „Weiteres“,
  Berichte ohne Überschriften (Namen lassen sich dort nicht abtrennen – nur die Zeile „Untersucht“ geht mit), englische Fassungen.
- **Vor jedem Auszug** nur `[Projektnummer · Gebäude n · n. Mitteilung · Abschnitt]` – nie der Ordnername; Gebäude als Nummer.
- **Platzhalter**: Den Berichtskopf liest LexiKit beim Öffnen der Vorschau frisch aus dem Bericht (nie im Index – der bleibt Fassung 1).
  VN, Risiko, Versicherer, Schaden-Nr., VS-Nr., Auftraggeber, Schadenort, Zeichen/Auftrags-Nr. und die Wörter des Projektordners (ohne
  Kürzel am Ende) werden nach Namensteilen ersetzt: Vor- und Nachnamen, Straße (auch „Str.“/„Strasse“) mit Hausnummer, PLZ, Ort,
  Nummern mit anderen Trennzeichen – nur ganze, groß geschriebene Wörter. → `[VN]`, `[Risikoort]`, `[Versicherer]`, `[Schaden-Nr.]`,
  `[VS-Nr.]`, `[Auftraggeber]`, `[Schadenort]`, `[Az.]`, `[Projekt]`. Laborproben-Nummern bleiben (nie Teil einer längeren Nummer).
  Bericht ohne erkannten Kopf: erst abgewählt.
- **Kopfwort = Fachwort**: Ein Kopfwort, das in einem Parameter-, Themen- oder Abschnittswort steckt („Schimmel“, „Brand“), wird nicht
  ersetzt, sondern als Stelle markiert.
- **Stellen**: Herr/Frau + Name, Straße + Nummer, PLZ + Ort, Telefon, E-Mail, Firmenform (GmbH, AG, e. V. …; nicht „KG“ = Kellergeschoss;
  Labore und Verbände wie Eurofins, GDV, DGUV, VdS ausgenommen), dazu die Kopfwörter oben. Auch die eigene Frage wird geprüft.
- Grenze: Namen, die nicht im Kopf stehen und ohne Herr/Frau, Firmenform oder Adresse vorkommen, erkennt keine Regel.

## Aufbau

Eine Datei `index.html` (Spektron-Look v1 byte-gleich, Kern-Block `LEXIKIT-KERN` ohne Browserteile, Oberfläche), dazu `sw.js`
(„Netz zuerst“ wie BerichtKit, nur eigene Dateien), `manifest.webmanifest`, `icon.svg`. App-Farbe `#2b6f6a` ist ein Platzhalter.

## Tests

```
node tests/kern.cjs       # Word lesen (erfundene .docx), Abschnitte, Kopf weg, Auswahl, Fälle, „Untersucht“, Rangfolge, Zusammenführen,
                          # Kopie für ChatGPT: Kopf, Platzhalter, Stellen, nie kopierte Abschnitte, 300 erzeugte Köpfe ohne Leck
node tests/dateien.cjs    # Spektron-Look gleich wie ../berichtkit, Offline-Dateien, kein Netz
node tests/browser.cjs    # Chromium mit erfundenem Archiv im OPFS (NODE_PATH auf playwright; CHROME=… optional);
                          # ab 0.3.0 zweites Archiv: Auswahl, Vorschau, Stellen, Zwischenablage = Vorschau
node tests/zeit-archivgroesse.cjs   # nicht in CI: Startzeit mit 4.663 erfundenen Berichten (einige Minuten; LC_ALL=C.UTF-8)
```

Testberichte (`tests/daten/berichte.cjs`) sind erfunden – keine echten Berichtstexte, keine Kundennamen.

## Regeln

- Liest nur in den Projektordnern, schreibt nie dorthin. Fügt nichts in Berichte ein.
- Keine KI, kein Netz – Wortsuche im Index.
- Außerhalb der Spektron-Kette (kein Schritt in der Leiste, kein Projektstand).
- Keine KI und kein Netz in LexiKit, auch nicht beim Kopieren für ChatGPT (`connect-src 'self'`).
- Nicht in 0.3.0: „Vorbild“-Markierungen, Links aus BerichtKit, Suchprotokoll, PDF, `.doc`.
