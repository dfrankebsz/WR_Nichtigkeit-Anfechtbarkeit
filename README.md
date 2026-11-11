# RechtQuest – Nichtigkeit und Anfechtbarkeit

Ein interaktiver, responsiver Lernkurs für Browser, Android, iOS, Windows und macOS mit **Netlify Functions + Netlify Blobs**, ohne Supabase und ohne allgemeinen `AUTH`-Schlüssel.

## Inhalt

- **Einstieg**, **Nichtigkeit** und **Anfechtbarkeit** als die drei inhaltlichen Kapitel.
- Eigenes Kapitel **Multiple-Choice-Training** mit allen Aufgaben 20–41 und 58–62 aus den Seiten 3–7 des Übungsblatts. Zuordnungsaufgaben sind interaktiv umgesetzt.
- **Abschlusstest** und eine rückgängig machbare Kompetenz-Checkliste mit neun Einträgen.
- **108 Aufgaben**, darunter alle Fallaufgaben von den ersten beiden Übungsblattseiten, Ergänzungsaufgaben und Bonusaufgaben; für jeden didaktischen Themenbereich sind AFB 1, 2 und 3 vertreten.
- Fragen werden untereinander angezeigt. Formate: Einfach- und Mehrfachauswahl, Richtig/Falsch, Kurzantwort, Zuordnung, Drag & Drop (mit Touch-Bedienung), Reihenfolge und Freitext mit eigener Selbstkontrolle.
- XP, Abzeichen, Avatar-Galerie, Haustiere, Outfits und freischaltbare Belohnungen.
- Eigener **PDF-Export** aller bereits beantworteten Aufgaben samt Schülerantworten ohne externe PDF-Bibliothek.
- Lehren und Lernen auch ohne Konto (nur lokal). Mit Konto werden der Lernstand und gekaufte Ausstattungen auf dem Netlify-Server gesichert.

## Bereitstellung mit GitHub und Netlify

### 1. Dateien in ein GitHub-Repository übernehmen

1. Diese ZIP **entpacken**.
2. Auf GitHub ein **neues Repository** erstellen (z. B. `rechtsquest`).
3. Die **Dateien und Ordner AUS dem entpackten Projektordner** in das Wurzelverzeichnis des GitHub-Repositories hochladen. Wichtig: `package.json`, `netlify.toml`, `public/`, `netlify/`, `scripts/` und `tests/` müssen im Repository nebeneinander liegen.
4. Änderungen committen. **Nicht die ZIP als einzelne Datei hochladen**.

### 2. GitHub mit Netlify verknüpfen

1. Netlify öffnen → **Add new project** → **Import an existing project**.
2. GitHub verbinden und das neue Repository auswählen.
3. Das Projekt enthält `netlify.toml`; relevante Einstellungen:

   | Einstellung | Wert |
   |---|---|
   | Build command | `npm run build` |
   | Publish directory | `public` |
   | Functions directory | `netlify/functions` |
   | Node | 22 |

4. In **Project configuration → Environment variables** genau diese Variable anlegen:

   **Key:** `LEHRER_CODE`  
   **Value:** ein **selbst gewählter, kryptografisch zufälliger Code mit mindestens 16 Zeichen**, am besten deutlich länger. Nicht in GitHub eintragen. Netlify muss die Variable auch für **Functions** bereitstellen.

   Es ist keine zusätzliche `AUTH`-, `AUTH_SECRET`-, SQL-, Supabase- oder Datenbankvariable erforderlich. Die Session-Signatur wird serverseitig aus dem Lehrer-Code abgeleitet. **Wird dieser Code geändert, verlieren bestehende Login-Sitzungen ihre Gültigkeit.** Benutzerkonten und Passwörter bleiben bestehen.

5. Das Deployment starten bzw. nach Hinzufügen der Umgebungsvariable erneut deployen.
6. Nach dem Deployment erscheint die Kursoberfläche. Unter `/api/status` sollte `"configured": true` gemeldet werden. Bei `false` ist der Lehrer-Code noch nicht korrekt für Functions gesetzt.

> **Wichtig:** Die Website ist als **GitHub/Netlify-Projekt** ausgelegt. Die Dateien dieser ZIP wurden nicht auf Ihrem GitHub-Konto oder auf Netlify veröffentlicht. Nur Sie können das Repository verbinden und den geheimen Lehrer-Code setzen.

### 3. Lehrerzugang anlegen

1. Im Kurs **Lehrerbereich** öffnen → **Zum Lehrer-Login**.
2. **Lehrkraft** auswählen → **Registrieren**.
3. **Klasse**, **Nickname** und eigenes **Passwort** eingeben.
4. Den bei Netlify hinterlegten **Lehrer-Code** einmalig zur Berechtigung eingeben.
5. Das neue Lehrerkonto wird dieser Klasse zugeordnet. Bei der späteren Anmeldung genügen **Klasse + Nickname + Passwort**.
6. Vergessenes Lehrerpasswort: **Lehrerpasswort neu setzen** auswählen und den Netlify-Lehrer-Code erneut eingeben.

Für eine weitere Klasse legen Sie ein weiteres Lehrerkonto mit der anderen Klassenbezeichnung an. Ein Lehrerkonto sieht nur Lernende der eigenen Klasse. Wer den Lehrer-Code kennt, kann grundsätzlich Lehrerkonten registrieren; verwahren Sie ihn entsprechend geschützt.

### 4. Schüleranmeldung und Gastmodus

- Ohne Anmeldung einfach starten. Der Fortschritt bleibt **lokal im jeweiligen Browser** und wird nicht auf andere Geräte übertragen.
- Für synchronisiertes Lernen: **Mit Konto lernen** → **Lernende** → **Registrieren**. **Klasse + selbst gewählter Nickname + Passwort** angeben. Danach kann an anderen Geräten mit denselben drei Angaben eingeloggt werden.
- Bei der Anmeldung eines frischen, leeren Kontos wird optional angeboten, bereits vorhandene Gastantworten zu übertragen. Bestehende gespeicherte Kontodaten werden **nicht stillschweigend überschrieben**.
- Derselbe Nickname darf in unterschiedlichen Klassen vorkommen. Innerhalb einer Klasse ist er eindeutig.
- Passwort muss mindestens acht Zeichen haben. Lehrkräfte können Schülerpasswörter durch ein **neues, zufällig generiertes Startpasswort** ersetzen. Alte Passwörter sind nicht auslesbar.

### 5. Lehrer-Dashboard

Lehrkräfte können ausschließlich in der ihnen zugewiesenen Klasse:

- alle Lernenden und ihren Bearbeitungsstand einsehen,
- den individuellen Lernstand mit eingegebenen Antworten öffnen,
- die Klassenübersicht als CSV exportieren,
- ein Nutzerpasswort zurücksetzen und das neue Passwort einmalig anzeigen,
- ein Schülerkonto mitsamt Lernstand entfernen,
- **alle Lernstände der Klasse löschen**, ohne die Nutzerkonten zu entfernen. Dabei werden aktive Schüler-Sitzungen ungültig; ein erneutes Login ist nötig.

**Eine Gesamtlöschung ist irreversibel.** Vor dem Löschen ist die Klassenbezeichnung ausdrücklich einzugeben.

## Technischer Aufbau

```text
rechtquest/
├── README.md
├── package.json                  (nur @netlify/blobs als Laufzeit-Abhängigkeit)
├── netlify.toml                 (Build, Functions, Sicherheits-Header)
├── public/
│   ├── index.html               (Webanwendung)
│   ├── style.css                (responsive Gestaltung)
│   ├── app.js                   (Interaktion, Übungen, Shop, Konten, Lehrer-UI)
│   ├── course-data.js           (Skripterklärungen, Lösungen, alle Aufgaben)
│   ├── pdf-export.js            (lokaler PDF-Generator)
│   └── assets/                  (eigene SVG-Illustrationen)
├── netlify/functions/api.mjs    (Accounts, Login, Lernstände, Rechte, Shop)
├── scripts/                     (Datenvalidierung und API-Smoke-Tests)
└── tests/                       (Testfälle mit simulierten Blobs)
```

### Datenspeicherung und Sicherheit

- Benutzerkonten und Fortschritte werden über **serverseitige Netlify Functions** in **Netlify Blobs** gespeichert. Die zwei Stores liegen in `eu-central-1`. Netlify Blobs benötigt keine SQL-Tabellen und keinen Supabase SQL Editor.
- Nutzerpasswörter werden mit **scrypt** und individuellen Salts gehasht, nicht im Klartext gespeichert.
- Sitzungstokens sind mit HMAC signiert, laufen ab und werden durch Kennwortwechsel, Kontoentfernung oder Klassen-Reset widerrufen.
- Lehrer-Code wird ausschließlich serverseitig aus der Umgebungsvariablen gelesen.
- Lehrkräfte dürfen die Daten **nur ihrer Klasse** abrufen und verändern. Ohne Login sind private Lernstände nicht über die API lesbar.
- Die API prüft angefragte Klassen, validiert Eingaben, hat eine plattformseitige IP-Rate-Limit-Konfiguration und verwendet bedingte Schreiboperationen für Fortschrittsänderungen.
- **Einschränkung:** Netlify Blobs ist ein Objektspeicher und keine relationale Transaktionsdatenbank. Die Anwendung verwendet individuelle Nutzerobjekte und bei Änderungen bedingte Schreiboperationen. Für hochskalierte, prüfungskritische Anwendungen wäre eine transaktionale Datenbank vorzuziehen.
- **Einschränkung:** Fragen und Musterlösungen werden an den Browser ausgeliefert, die Selbstbewertung von Freitexten erfolgt durch Lernende. Die XP sind eine Lernmotivation und **nicht manipulationssicher als Prüfungsnote**. Die Plattform ist kein abgesichertes Prüfungs-/Klausursystem.
- Netlify Blobs Stores sind **site-wide** und können zwischen Deploy-Kontexten geteilt sein. Test- und Vorschau-Deployments sollten nicht mit echten Schülerdaten bespielt werden.

### Datenschutz / Schule

Vor einer öffentlichen Nutzung mit realen Schülerinnen und Schülern sind durch die Schule bzw. die verantwortliche Lehrkraft **Datenschutz-Freigabe, Rechtsgrundlage, Verzeichnis der Verarbeitungstätigkeiten, Netlify-Vertragsbedingungen / Auftragsverarbeitungsvertrag, Drittland-Transfers, Löschfristen und ein schulbezogener Datenschutzhinweis** zu prüfen. Die Wahl der EU-Blob-Region allein ist **keine vollständige DSGVO-Garantie**. Bitte keine Klarnamen, Noten, Gesundheitsdaten oder unnötige personenbezogene Angaben in Nicknames und Freitextfeldern verwenden.

Der KI-Nachweis in der Website ist eine gewünschte **Vorlage**. Die abschließende fachliche und redaktionelle Prüfung durch die Lehrkraft ist vor Freigabe tatsächlich durchzuführen und entsprechend zu bestätigen.

## Fachliche Präzisierungen gegenüber den älteren Unterlagen

Die Aufgaben wurden so weit wie möglich an den Ausgangsmaterialien orientiert, jedoch offensichtliche Rechtsfehler und übermäßig pauschale Musterlösungen zugunsten einer korrekten Schülerprüfung präzisiert:

- Minderjährige ab sieben Jahren sind **beschränkt geschäftsfähig** (§ 106 BGB); ohne erforderliche Einwilligung ist ein belastender Vertrag grundsätzlich **schwebend unwirksam** (§ 108 BGB), **nicht** wegen § 105 automatisch nichtig.
- § 120 BGB verlangt eine **unrichtige Übermittlung durch eine eingesetzte Person oder Einrichtung**. Ein bloßes Verhören des Empfängers erfüllt § 120 nicht automatisch.
- Bei § 138 BGB beweist der **hohe Preis allein** nicht sämtliche Voraussetzungen der Sittenwidrigkeit oder des Wuchers.
- Die **Vertragsabfassung** bei Ausbildungsverträgen ist nach aktuellem § 11 BBiG in **Textform** vorzunehmen. Die ältere Vorlage verwendete an dieser Stelle teils eine strengere Formzuordnung.
- Der in einem alten Zuordnungsteil verwendete Ausdruck „schwebend wirksam“ ist als **schwebend unwirksam** korrigiert.
- Scherzgeschäfte erfordern die gesetzlichen Voraussetzungen des § 118 BGB, nicht bloß die nachträgliche Aussage „war nur Spaß“.

Quellen zur Kontrolle: [BGB](https://www.gesetze-im-internet.de/bgb/), [§ 11 BBiG](https://www.gesetze-im-internet.de/bbig_2005/__11.html), [Netlify Functions](https://docs.netlify.com/build/functions/), [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).

## Selbsttests

Nach Installation von Node.js 22 können Sie im Projektverzeichnis folgende Befehle ausführen:

```bash
npm install
npm run build
npm test
node scripts/smoke-api.mjs
```

Die Testskripte prüfen die Aufgabenquellen, den Aufgabenindex, die AFB-Verteilung, die PDF-Erstellung sowie den API-Ablauf in einer **simulierten Blob-Umgebung** (Registrierung, Klassenisolation, Rollenrechte, Fortschritt, Passwort-Reset, Löschung). Bei `npm run build` wird keine bundlergestützte JavaScript-Kompilierung benötigt; die Website besteht aus nativen HTML/CSS/ES-Modulen.

Die Weboberfläche kann für **reine Gast-Vorschau** mit einem beliebigen statischen HTTP-Server aus dem Ordner `public/` geöffnet werden. Die echte Netlify-Anmeldung und Blobs-Synchronisierung funktionieren erst mit bereitgestellten Netlify Functions.
