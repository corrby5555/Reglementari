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
REGLEMENTARI_WRITE_IPS="127.0.0.1,10.0.0.12,10.8.0.0/24"
REGLEMENTARI_READONLY_IPS="10.0.0.0/24"
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

## Control acces după IP

Aplicația poate limita operațiile de scriere după IP-ul calculatorului client.

`REGLEMENTARI_WRITE_IPS` definește IP-urile sau subneturile care pot adăuga, modifica și șterge reglementări. Acceptă IP-uri exacte și CIDR, separate prin virgulă:

```env
REGLEMENTARI_WRITE_IPS="127.0.0.1,10.0.0.12,10.8.0.0/24"
```

`REGLEMENTARI_READONLY_IPS` este documentar/configurabil pentru rețeaua permisă la citire:

```env
REGLEMENTARI_READONLY_IPS="10.0.0.0/24"
```

Dacă nu este configurată nicio regulă, aplicația permite scrierea, ca să nu blocheze dezvoltarea locală. După configurarea `REGLEMENTARI_WRITE_IPS`, toate IP-urile care nu se potrivesc cu lista respectivă au doar acces de citire. Protecția este aplicată atât în interfață, cât și pe API-urile `POST`, `PATCH` și `DELETE`.

În spatele unui proxy/nginx, transmite IP-ul real prin `X-Forwarded-For` sau `X-Real-IP`.

## TODO

- Definirea listei finale de valori pentru `domeniu`.
- Confirmarea politicii finale la coliziune: în prezent aplicația blochează același `indicativ + an`, iar pentru coliziuni fizice de fișier aplică sufix incremental.
