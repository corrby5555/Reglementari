import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { DeleteRegulationButton } from "@/components/DeleteRegulationButton";
import { canWriteFromHeaders } from "@/lib/access-control";
import { parseIndicativeReferences } from "@/lib/indicative-references";
import { getRegulation, listRegulationsByReferences, listUpdatesForIndicativ } from "@/lib/reglementari";

type DetailProps = {
  params: { id: string };
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-gridline py-3 md:grid-cols-[220px_1fr]">
      <dt className="label">{label}</dt>
      <dd className="text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

export default async function RegulationDetailPage({ params }: DetailProps) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const item = await getRegulation(id);
  if (!item) notFound();
  const updatedReferences = parseIndicativeReferences(item.actualizeazaIndicativ);
  const updatedDocuments = await listRegulationsByReferences(updatedReferences, item.id);
  const updates = await listUpdatesForIndicativ(item.indicativ, item.an, item.id);
  const canWrite = canWriteFromHeaders(headers());

  return (
    <main className="page-shell">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">{item.tipReglementare} / {item.disciplina}</p>
          <h1 className="text-3xl font-bold text-ink">{item.indicativ} / {item.an}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="btn">Retur</Link>
          {canWrite ? <Link href={`/reglementari/${item.id}/edit`} className="btn">Modifică</Link> : null}
          {canWrite ? <DeleteRegulationButton id={item.id} /> : null}
          <a href={`/api/reglementari/${item.id}/fisier`} className="btn btn-primary" target="_blank" rel="noopener noreferrer">
            Deschide fișier
          </a>
        </div>
      </div>
      <section className="sheet p-5">
        <dl>
          <DetailRow label="Denumire exactă" value={item.denumireExacta} />
          <DetailRow label="Descriere" value={<span className="font-normal leading-6">{item.descriere}</span>} />
          <DetailRow label="Tip document" value={item.tipDocument} />
          <DetailRow label="Domeniu" value={item.domeniu} />
          <DetailRow label="Disciplina" value={item.disciplina} />
          <DetailRow label="Descriere nume fișier" value={item.descriereNumeFisier} />
          <DetailRow
            label="Actualizează indicativ"
            value={
              updatedReferences.length > 0 ? (
                <div className="grid gap-1">
                  {updatedReferences.map((reference) => {
                    const document = updatedDocuments.find((row) => `${row.indicativ} / ${row.an}` === reference || row.indicativ === reference);
                    return document ? (
                      <Link key={reference} href={`/reglementari/${document.id}`} className="text-accent hover:underline">
                        {document.indicativ} / {document.an} - {document.denumireExacta}
                      </Link>
                    ) : (
                      <span key={reference}>{reference}</span>
                    );
                  })}
                </div>
              ) : "-"
            }
          />
          <DetailRow
            label="Actualizat de indicativ"
            value={
              updates.length > 0 ? (
                <div className="grid gap-1">
                  {updates.map((update) => (
                    <Link key={update.id} href={`/reglementari/${update.id}`} className="text-accent hover:underline">
                      {update.indicativ} / {update.an} - {update.denumireExacta}
                    </Link>
                  ))}
                </div>
              ) : "-"
            }
          />
          <DetailRow label="Cuvinte cheie" value={item.tipCladire} />
          <DetailRow label="Limba" value={item.limba} />
          <DetailRow label="Nume fișier" value={item.numeFisier} />
          <DetailRow label="Cale fișier" value={<span className="break-all font-mono text-xs">{item.caleFisier}</span>} />
          <DetailRow label="Data adăugării" value={item.dataAdaugare.toLocaleString("ro-RO")} />
        </dl>
      </section>
    </main>
  );
}
