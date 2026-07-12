import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="brand"><span className="brand-mark">DM</span><span>DocManager</span></Link>
      <article>
        <p className="eyebrow">Legal</p>
        <h1>Termeni si conditii</h1>
        <p>Acest document stabileste regulile generale de utilizare a platformei DocManager, inclusiv crearea contului, incarcarea documentelor, trimiterea pachetelor si responsabilitatea utilizatorului asupra continutului incarcat.</p>
        <p>Documentele raman accesibile conform permisiunilor acordate de utilizator, iar accesul poate fi jurnalizat pentru siguranta si audit.</p>
      </article>
    </main>
  );
}
