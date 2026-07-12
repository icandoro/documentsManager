import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="brand"><span className="brand-mark">DM</span><span>DocManager</span></Link>
      <article>
        <p className="eyebrow">Legal</p>
        <h1>Politica de confidentialitate</h1>
        <p>Platforma proceseaza date precum email, nume, telefon, preferinte de limba, timezone, documente incarcate si istoricul pachetelor trimise sau primite.</p>
        <p>Pentru productie trebuie adaugate politici clare de retentie, criptare la nivel de stocare, audit, export date si stergere cont conform cerintelor legale aplicabile.</p>
      </article>
    </main>
  );
}
