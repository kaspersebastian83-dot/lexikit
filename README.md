# LexiKit (Spektron)

**Frühere Fälle aus den fertigen Word-Berichten des Büros finden** – „Wie haben wir das früher gemacht?“. Für alle, die ein altes
Vorgehen nachsehen wollen, ohne jemanden fragen zu müssen. Läuft im Browser (Edge/Chrome), ohne Server, ohne KI, ohne Netz.
Ab 0.2.0 ist die Einheit der **Fall**: ein Projektordner mit allen seinen Mitteilungen. Ab 0.3.0 lassen sich bis zu drei Fälle
**für ChatGPT kopieren** – LexiKit selbst sendet nichts, man fügt den Text selbst ein. Ab 0.4.0 zeigt LexiKit über den Fällen,
**wie wir es meist machen**, und darunter **unsere Absätze** zum Thema – zum Kopieren, mit Markierungen „Vorbild“ / „So nicht mehr“.

Adresse: `https://kaspersebastian83-dot.github.io/lexikit/` (GitHub Pages muss für dieses Repo eingeschaltet sein).
Gleiche Adresse wie die anderen Apps → LexiKit nimmt den Archivordner, den die Projektzentrale gewählt hat
(Browser-Speicher `mosaik-suite`, Schlüssel `archiv`, nur gelesen). Eine eigene Wahl steht unter `lexikit-archiv`.

Plan und Entscheidungen: Projekt-Docs `claude/lexikit-plan.md`, `claude/lexikit-stufe2-plan.md`, `claude/lexikit-stufe2-zaehlung.md`,
`claude/lexikit-oft-verwendet-plan.md` (0.4.0),
Stand: `claude/lexikit-stand.md`.

**0.4.2 (21.11.2026, Audit Lauf 5, E8):** Menü „Mehr …“ (statt „⋯ Mehr“), Link „💬 Rückmeldung ↗“, Tooltip „Fehler oder Wunsch melden – …“ – gleiche Namen wie in den anderen Spektron-Apps.

**0.4.1 (20.11.2026, Audit Lauf 4):** „⋯ Mehr“ › „Fehler oder Wunsch melden ↗“ öffnet `../rueckmeldung/?app=lexikit&version=…` im Fenster `rueckmeldung` (ohne Projekt – LexiKit hat keins). Die CI läuft zusätzlich nachts, damit der Look-Vergleich mit BerichtKit (`tests/dateien.cjs`) eine Änderung dort gleich meldet. Offline-Cache v5.

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
`lexikit-themen.json`, `lexikit-index-<Jahr>.json`, ab 0.4.0 `lexikit-kopien.json`, `lexikit-markierungen.json`,
`lexikit-einstellungen.json`). LexiKit legt den Ordner nicht selbst an.

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
- **Kopier-Zähler** (`lexikit-kopien.json`, ab 0.4.0): je Kopie `{ id, w (Fassung), am }`, ohne Namen. **Markierungen**
  (`lexikit-markierungen.json`): `{ id, w, art: vorbild|nicht, wer (Kürzel), warum, statt?, am, beispiel, k, zurueck? }`.
  **Einstellung** (`lexikit-einstellungen.json`): `aehnlichkeit` (streng/normal/locker), `geaendert`. Kopien und Markierungen werden nie
  gelöscht, nur ergänzt; Zurücknehmen ist ein Vermerk an der Markierung. Schreiben: neu lesen, nach id vereinigen, schreiben, nach
  1,5 s zurücklesen und prüfen, ob alles Eigene darin steht – sonst noch einmal (bis zu 4 Mal, dann Fehlermeldung). Unlesbare oder
  fremde Datei → wird nie überschrieben. Bei der Einstellung gilt die jüngere Änderung.
- Der Index enthält Berichtstext und ist so vertraulich wie die Berichte.

## Einlesen

Erster Start: alles, neueste Jahre zuerst, mit Fortschritt (Projektordner), Suchen geht schon währenddessen. Gespeichert wird nach
jedem Jahr, alle 90 s und bei „Anhalten“. Danach bei jedem Start im Hintergrund: nur Berichte mit anderer Größe oder Dateizeit,
neue, nicht mehr ausgewählte (ersetzt, gelöscht) fallen heraus. „Mehr …“: Neue Berichte suchen · Einlesen ansehen · Alle neu
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
- **Abschnitt kopieren**: der gezeigte Reiter in die Zwischenablage (LexiKit fügt nirgends ein). Ab 0.4.0 liest es dafür den
  Berichtskopf jeder Mitteilung frisch und ersetzt Namen und Adressen daraus durch Platzhalter (wie unten).
- **Projektordner**: kopiert den Pfad (im Explorer in die Adresszeile einfügen).
- **Für ChatGPT kopieren**: öffnet die Vorschau mit diesem Fall (siehe unten).

## So machen wir es meist · Unsere Absätze (ab 0.4.0)

- **Praxisprofil** über den Fällen eines Themas oder einer Suche: „Untersucht auf“ als Balken (gezählt aus den „Untersucht“-Schildchen;
  ein Klick setzt denselben Filter wie die Schildchen oben), Proben je Fall (mittlere Hälfte, „meist 8 bis 10“), Berichtsform,
  Mitteilungen je Fall, Fälle mit Sanierungsmaßnahmen. Nur gezählt, nicht bewertet.
- **Unsere Absätze**: die Absätze aus Sanierungsmaßnahmen, Schlussfolgerungen und Arbeitsschutz der passenden Fälle (ohne
  Tabellenzeilen, ohne Absätze unter fünf Wörtern), so gezeigt, wie sie im Bericht stehen. Je Absatz „n × kopiert“, „zuletzt verwendet
  <Jahr>“, „in n Fällen im Archiv“ (ganzes Archiv), „n Fassungen“, „Ähnliche Absätze zeigen“, Knöpfe „Kopieren“ und „Fälle zeigen“.
- **Fassung** = Absatz nach dem Angleichen: Groß/Klein, Leerraum, Satzzeichen; jedes Wort mit Ziffer (Zahlen, Proben- und
  Labornummern) wird zu `#`; Straße + Hausnummer und PLZ + Ort (Muster wie bei den „Stellen“) zu je einem Zeichen. Werte aus dem
  Berichtskopf werden nicht benutzt. Zähler und Markierungen hängen an der Fassung (Schlüssel = Hash der angeglichenen Wörter; die
  Markierung speichert dazu ein Beispiel, damit sie nach einer Regeländerung wieder zugeordnet werden kann).
- **Familie** = fast gleiche Fassungen, je Abschnittsklasse. Ähnlichkeit = längste gemeinsame Wortfolge / Wortzahl des längeren
  Absatzes (Basti, 19.11.2026: Wörter in derselben Reihenfolge statt Dreiwortfolgen – ein anderer Ort in einem Absatz mit 27 Wörtern
  ergab mit Dreiwortfolgen 72 %, so 93 %). Einstellung „Ähnlichkeit“ unter „Mehr“: streng 90 %, normal 85 %, locker 75 %, eine fürs
  ganze Büro. „Ähnliche Absätze zeigen“: eine Stufe lockerer (unter „locker“ 60 %), nur für diesen Absatz.
  **Kippwörter** (nicht, kein…, vor, nach, trocken…, feucht…, mindestens, höchstens): Sind sie der einzige Unterschied, bleiben die
  Absätze getrennt. Eine Familie bildet sich um eine **Leitfassung** (die mit den meisten Fällen); jede andere muss ihr selbst ähnlich
  genug sein – keine Ketten über eine dritte Fassung. Vergleich mit Vorfilter (seltene Wörter), in Schritten, damit die Seite bedienbar bleibt.
- **Sortieren**: „Oft verwendet“ = Kopien der letzten zwei Jahre (Summe der Familie), Gleichstand → Fälle im Archiv → neuer;
  „Oft im Archiv“ = Fälle im Archiv. Gezeigt wird je Familie das „Vorbild“, sonst die neueste Fassung.
- **Kopieren** kopiert die neueste Stelle genau dieser Fassung, wie geschrieben; den Kopf dieses einen Berichts liest LexiKit frisch und
  ersetzt Namen und Adressen daraus und die Wörter des Projektordners (`[VN]`, `[Risikoort]`, `[Projekt]` …, Regeln wie 0.3.0). Keine
  Vorschau, keine Sperre. Kopfwörter, die Fachwörter sind, bleiben stehen. Ist der Kopf nicht lesbar, wird trotzdem kopiert (nur der
  Ordner ersetzt) und die Meldung sagt das. Gezählt wird für genau diese Fassung.
- **Familienansicht**: Fassungen nach Zeitraum, die aktuelle (neueste) oben, Unterschiede hinterlegt; „Zuletzt so geschrieben in“ mit
  „Fall öffnen“ (Stelle markiert).
- **Markierungen** „Vorbild …“ / „So nicht mehr …“: jeder darf; Formular „Wer bist du?“ (aktive Personen aus `_Spektron-Mitarbeiter.json`
  im Archivordner – nur gelesen; fehlt oder unlesbar → Markieren geht nicht, mit Hinweis), „Warum? (Pflicht)“, „Stattdessen“ (optional).
  „So nicht mehr“ stellt die Fassung ans Ende, grau, mit Name, Datum und Grund – sie bleibt in Suche, Fall und Word. Zurücknehmen
  braucht Name und Grund; die frühere Markierung bleibt als Verlauf sichtbar.

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
                          # Kopie für ChatGPT: Kopf, Platzhalter, Stellen, nie kopierte Abschnitte, 300 erzeugte Köpfe ohne Leck,
                          # ab 0.4.0 Fassungen, Ähnlichkeit, Kippwörter, Familien je Stufe, Sortierung, zwei Jahre, Markierungen,
                          # zwei PCs auf denselben Dateien, Platzhalter beim Kopieren, Praxisprofil
node tests/dateien.cjs    # Spektron-Look gleich wie ../berichtkit, Offline-Dateien, kein Netz
node tests/browser.cjs    # Chromium mit erfundenem Archiv im OPFS (NODE_PATH auf playwright; CHROME=… optional);
                          # ab 0.3.0 zweites Archiv: Auswahl, Vorschau, Stellen, Zwischenablage = Vorschau
                          # ab 0.4.0 drittes Archiv: Profil, Absätze, Kopieren mit Platzhaltern, Markieren, zweiter PC, Ähnlichkeit
node tests/zeit-archivgroesse.cjs   # nicht in CI: Startzeit mit 4.663 erfundenen Berichten (einige Minuten; LC_ALL=C.UTF-8)
```

Testberichte (`tests/daten/berichte.cjs`) sind erfunden – keine echten Berichtstexte, keine Kundennamen.

## Regeln

- Liest nur in den Projektordnern, schreibt nie dorthin. Fügt nichts in Berichte ein.
- Keine KI, kein Netz – Wortsuche im Index.
- Außerhalb der Spektron-Kette (kein Schritt in der Leiste, kein Projektstand).
- Keine KI und kein Netz in LexiKit, auch nicht beim Kopieren für ChatGPT (`connect-src 'self'`).
- Nicht in 0.4.0: Links aus BerichtKit, Suchprotokoll, PDF, `.doc`.
