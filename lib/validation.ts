import { z } from "zod";
import { normalizeFileDescription } from "@/lib/file-name-description";
import { disciplines, documentTypes, domainOptions, languages, regulationTypes } from "@/lib/options";
import { serializeIndicativeReferences } from "@/lib/indicative-references";

function sentenceCase(value: string) {
  const lower = value.trim().toLocaleLowerCase("ro-RO");
  let shouldCapitalize = true;
  let result = "";

  for (const char of lower) {
    const isLetter = char.toLocaleLowerCase("ro-RO") !== char.toLocaleUpperCase("ro-RO");
    if (shouldCapitalize && isLetter) {
      result += char.toLocaleUpperCase("ro-RO");
      shouldCapitalize = false;
      continue;
    }

    result += char;
    if (/[.!?]/.test(char)) {
      shouldCapitalize = true;
    } else if (isLetter) {
      shouldCapitalize = false;
    }
  }

  return result;
}

export const regulationSchema = z.object({
  indicativ: z.string().trim().min(1, "Indicativul este obligatoriu.").max(80),
  an: z.coerce.number().int().min(1800, "Anul pare prea mic.").max(2200, "Anul pare prea mare."),
  tipReglementare: z.enum(regulationTypes, "Alege tipul reglementării."),
  tipDocument: z.enum(documentTypes, "Alege tipul documentului."),
  disciplina: z.enum(disciplines, "Alege disciplina."),
  domeniu: z.enum(domainOptions, "Alege domeniul."),
  descriereNumeFisier: z.string()
    .trim()
    .transform(normalizeFileDescription)
    .pipe(
      z.string()
        .min(1, "Descrierea pentru numele fișierului este obligatorie.")
        .max(180, "Descrierea pentru numele fișierului este prea lungă.")
        .regex(/^[a-z0-9_]+$/, "Descrierea pentru numele fișierului acceptă doar litere mici fără diacritice, cifre și caracterul _."),
    ),
  actualizeazaIndicativ: z.preprocess(
    serializeIndicativeReferences,
    z.string().max(1000).default(""),
  ),
  tipCladire: z.string().trim().max(180).default(""),
  descriere: z.string().trim().max(5000).default(""),
  denumireExacta: z.string().trim().min(4, "Denumirea exactă este obligatorie.").max(500).transform(sentenceCase),
  limba: z.enum(languages, "Alege limba."),
});

export type RegulationInput = z.infer<typeof regulationSchema>;
