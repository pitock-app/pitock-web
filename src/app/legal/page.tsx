import type { Metadata } from "next";

export const metadata: Metadata = { title: "Termini e privacy" };

// Bozza: i campi tra [ ] vanno completati e il testo rivisto da un legale prima della vendita.
const sections: [string, string, string[]][] = [
  [
    "note",
    "Note legali",
    [
      "Titolare del servizio e del trattamento: [NOME O RAGIONE SOCIALE], [SEDE], P.IVA [P.IVA], [REA se società]. Contatti: [EMAIL], PEC [PEC].",
    ],
  ],
  [
    "privacy",
    "Informativa privacy (artt. 13-14 GDPR)",
    [
      "Dati trattati: email e credenziali; file degli scontrini e dati estratti (esercente, importi, prodotti); chiavi API fornite dall'utente, cifrate; registro delle chiamate al modello di IA.",
      "Finalità e basi giuridiche: erogazione del servizio e analisi della spesa (contratto, art. 6.1.b); dati sanitari eventualmente presenti negli scontrini, es. farmacia (consenso esplicito, art. 9.2.a), revocabile in ogni momento scrivendo a [EMAIL] o cancellando l'account; sicurezza e obblighi di legge (art. 6.1.c e 6.1.f).",
      "Intelligenza artificiale: le immagini degli scontrini sono lette da un modello di IA di terzi (Anthropic, OpenAI o OpenRouter, oppure il provider scelto con la propria chiave). I risultati possono contenere errori e sono modificabili. Codici fiscali, nomi di persone e numeri di carte non vengono estratti. I fornitori non usano i dati per addestrare i modelli.",
      "Responsabili del trattamento: Supabase (database, file, autenticazione), Vercel (hosting), Inngest (elaborazioni in background), i provider di IA indicati. Alcuni hanno sede negli USA: il trasferimento avviene in base al Data Privacy Framework UE-USA o a clausole contrattuali tipo. Server in UE dove disponibile.",
      "Conservazione: finché l'account è attivo; alla cancellazione dell'account file e dati sono eliminati subito, i backup dei fornitori entro [N] giorni; i log tecnici per il tempo previsto dal fornitore di hosting.",
      "Diritti: accesso, rettifica (modificando gli scontrini), cancellazione (Impostazioni > Account), portabilità (Scarica i miei dati), limitazione, opposizione, revoca del consenso: [EMAIL]. Reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).",
      "Cookie: solo cookie tecnici di sessione, necessari per l'accesso; nessun cookie di profilazione o analisi.",
    ],
  ],
  [
    "termini",
    "Termini di servizio",
    [
      "Pitock raccoglie gli scontrini caricati dall'utente, ne estrae i dati con un modello di IA e mostra statistiche, previsioni e consigli di risparmio. Stime e consigli sono indicativi, basati solo sui dati caricati, e non sono consulenza finanziaria.",
      "Il servizio è riservato a maggiorenni. L'utente carica solo scontrini propri o di cui ha titolo e custodisce le proprie credenziali. Usando una propria chiave API accetta i termini del relativo provider e ne sostiene i costi.",
      "Prezzi, durata, rinnovo e disdetta: [DA DEFINIRE PRIMA DELLA VENDITA]. Il consumatore può recedere entro 14 giorni dall'acquisto scrivendo a [EMAIL] o con l'apposita funzione nell'app.",
      "Restano salvi i diritti del consumatore previsti dal Codice del Consumo (D.Lgs. 206/2005), compresa la garanzia di conformità dei servizi digitali. Legge italiana; foro del consumatore. Reclami: [EMAIL].",
      "Il nome e il logo Pitock sono segni distintivi del titolare e non sono coperti dalla licenza del codice sorgente.",
    ],
  ],
];

export default function LegalPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <p className="text-muted-foreground text-sm">Versione 2026-10</p>
      {sections.map(([id, title, paragraphs]) => (
        <section key={id} id={id} className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          {paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </section>
      ))}
    </main>
  );
}
