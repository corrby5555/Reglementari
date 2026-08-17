# Catalog Reglementări Tehnice

Aplicație internă Next.js pentru catalogarea reglementărilor tehnice AIP: căutare, filtrare, detaliu reglementare și încărcare fișiere redenumite automat.

## Câmpuri principale

Catalogul salvează pentru fiecare reglementare: indicativ, an, tip reglementare, tip document, disciplină, domeniu, descriere nume fișier, cuvinte cheie, descriere, denumire exactă, limbă și locația fișierului pe disc.

Valorile pentru `tip document` sunt:

- `legislatie`
- `informatie`
- `tehnic`

## Configurare

1. Creează baza MariaDB și utilizatorul:

```sql
CREATE DATABASE IF NOT EXISTS reglementari CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'reglementari'@'%' IDENTIFIED BY 'parola_ta';
GRANT ALL PRIVILEGES ON reglementari.* TO 'reglementari'@'%';
FLUSH PRIVILEGES;
```

2. Creează `.env.local` pornind de la `.env.example`:

```bash
DATABASE_URL="mysql://reglementari:parola_ta@10.0.0.245:3306/reglementari"
REGLEMENTARI_STORAGE_SHARE="//10.0.0.231/Documentatie"
REGLEMENTARI_STORAGE_DIR="/Volumes/Documentatie"
REGLEMENTARI_BULK_DIR="/Volumes/Documentatie/0_Reglementari"
```

3. Instalează dependențele și inițializează tabela:

```bash
npm install
npm run setup:db
```

## Rulare

```bash
npm run dev
```

Aplicația rulează pe `http://localhost:3015`.

Pentru producție locală:

```bash
npm run build
npm run start
```

## Stocare fișiere

Fișierele încărcate sunt salvate pe disc, nu în baza de date.

Share-ul real este declarat prin `REGLEMENTARI_STORAGE_SHARE`:

```text
//10.0.0.231/Documentatie
```

Aplicația scrie însă în calea montată local, declarată prin `REGLEMENTARI_STORAGE_DIR`. Pe Mac aceasta este de regulă:

```text
/Volumes/Documentatie
```

Pe serverul Linux poate fi, de exemplu:

```text
/mnt/reglementari-storage
```

`REGLEMENTARI_STORAGE_DIR` indică rădăcina share-ului `Documentatie`, iar aplicația salvează în:

```text
{REGLEMENTARI_STORAGE_DIR}/Reglementari/{disciplina}/...
{REGLEMENTARI_STORAGE_DIR}/Informatie/{disciplina}/...
{REGLEMENTARI_STORAGE_DIR}/Tehnica/{disciplina}/...
```

Dacă disciplina este `general`, se mai creează un nivel cu domeniul:

```text
{REGLEMENTARI_STORAGE_DIR}/Reglementari/general/{domeniu}/...
```

Baza de date reține doar `nume_fisier` și `cale_fisier`.

## Import provizoriu din Excel

Scriptul provizoriu citește un fișier Excel, caută PDF-urile într-un folder sursă, le copiază redenumite în storage, creează înregistrările în MariaDB și apoi șterge PDF-ul sursă. Dacă lângă PDF există un fișier `.doc` sau `.docx` cu același nume de bază, îl șterge după importul reușit.

Coloane acceptate în Excel, cu denumiri flexibile:

```text
indicativ
an
tip reglementare
tip document
disciplina
domeniu
descriere nume fisier
actualizeaza indicativ
cuvinte cheie
descriere
denumire exacta
limba
fisier pdf
```

Rulare de probă, fără modificări:

```bash
npm run import:reglementari -- --excel /cale/catalog.xlsx --source-dir /cale/pdf-uri --dry-run
```

Rulare efectivă:

```bash
npm run import:reglementari -- --excel /cale/catalog.xlsx --source-dir /cale/pdf-uri
```

Opțional, pentru un sheet anume:

```bash
npm run import:reglementari -- --excel /cale/catalog.xlsx --source-dir /cale/pdf-uri --sheet Sheet1
```

## TODO

- Definirea listei finale de valori pentru `domeniu`.
- Confirmarea politicii finale la coliziune: în prezent aplicația blochează același `indicativ + an`, iar pentru coliziuni fizice de fișier aplică sufix incremental.
