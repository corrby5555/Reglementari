import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "fs";

function loadEnvLocal() {
  if (!existsSync(".env.local")) {
    return;
  }

  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

loadEnvLocal();

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS reglementari (
      id INT NOT NULL AUTO_INCREMENT,
      indicativ VARCHAR(80) NOT NULL,
      an INT NOT NULL,
      tip_reglementare VARCHAR(80) NOT NULL,
      tip_document VARCHAR(40) NOT NULL DEFAULT 'informatie',
      disciplina VARCHAR(120) NOT NULL,
      domeniu VARCHAR(180) NOT NULL,
      descriere_nume_fisier VARCHAR(180) NOT NULL DEFAULT '',
      actualizeaza_indicativ VARCHAR(1000) NOT NULL DEFAULT '',
      tip_cladire VARCHAR(180) NOT NULL,
      descriere TEXT NOT NULL,
      denumire_exacta VARCHAR(500) NOT NULL,
      limba VARCHAR(8) NOT NULL,
      nume_fisier VARCHAR(260) NOT NULL,
      cale_fisier VARCHAR(1000) NOT NULL,
      data_adaugare DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY reglementari_indicativ_an_unique (indicativ, an),
      KEY reglementari_tip_idx (tip_reglementare),
      KEY reglementari_disciplina_idx (disciplina),
      KEY reglementari_limba_idx (limba)
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE reglementari
    ADD COLUMN IF NOT EXISTS tip_document VARCHAR(40) NOT NULL DEFAULT 'informatie'
    AFTER tip_reglementare;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE reglementari
    ADD COLUMN IF NOT EXISTS descriere_nume_fisier VARCHAR(180) NOT NULL DEFAULT ''
    AFTER domeniu;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE reglementari
    ADD COLUMN IF NOT EXISTS actualizeaza_indicativ VARCHAR(1000) NOT NULL DEFAULT ''
    AFTER descriere_nume_fisier;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE reglementari
    MODIFY actualizeaza_indicativ VARCHAR(1000) NOT NULL DEFAULT '';
  `);

  console.log("Baza MariaDB pentru catalogul de reglementari este pregatita.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
