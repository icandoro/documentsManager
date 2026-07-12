import Link from "next/link";
import { ArrowRight, CheckCircle2, FileSignature, LockKeyhole, PackageCheck, ShieldCheck, UsersRound } from "lucide-react";

const features = [
  { icon: ShieldCheck, title: "Cont securizat", text: "Email, parola, 2FA si token-uri pentru sesiuni si actiuni sensibile." },
  { icon: PackageCheck, title: "Pachete de documente", text: "Grupezi documente, denumesti pachetul si alegi destinatarul dupa email sau cod de cont." },
  { icon: FileSignature, title: "Pregatit pentru semnare", text: "Fluxul include documente semnate, re-incarcate si trimise inapoi catre expeditor." },
  { icon: UsersRound, title: "Profil complet", text: "Date personale, firma, limba, timezone si campuri optionale intr-o zona discreta." }
];

export default function Home() {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Link href="/" className="brand">
          <span className="brand-mark">DM</span>
          <span>DocManager</span>
        </Link>
        <nav>
          <Link href="#features">Functionalitati</Link>
          <Link href="/legal/terms">Termeni</Link>
          <Link href="/auth/login">Login</Link>
          <Link href="/auth/register" className="nav-cta">Creeaza cont</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="pill">Documente personale si business intr-un singur cont</span>
          <h1>DocManager</h1>
          <p className="hero-lead">
            Trimiti buletine, contracte, certificate si pachete de documente catre alti utilizatori, cu istoric clar pe expeditor, destinatar si status.
          </p>
          <div className="hero-actions">
            <Link href="/auth/register" className="primary-button">Incearca gratuit <ArrowRight size={18} /></Link>
            <Link href="/auth/login" className="secondary-button">Intra in cont</Link>
          </div>
        </div>

        <div className="hero-product" aria-label="Previzualizare dashboard">
          <div className="mock-window">
            <div className="mock-header">
              <span />
              <span />
              <span />
            </div>
            <div className="mock-content">
              <div className="mock-metric"><strong>24</strong><span>Documente</span></div>
              <div className="mock-metric accent"><strong>8</strong><span>Pachete trimise</span></div>
              <div className="mock-list">
                <p><CheckCircle2 size={16} /> Dosar angajare primit</p>
                <p><LockKeyhole size={16} /> 2FA activ pe cont</p>
                <p><FileSignature size={16} /> Semnare in asteptare</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="feature-band" id="features">
        {features.map((feature) => (
          <article className="feature-card" key={feature.title}>
            <feature.icon size={28} />
            <h2>{feature.title}</h2>
            <p>{feature.text}</p>
          </article>
        ))}
      </section>

      <section className="presentation">
        <div>
          <p className="eyebrow">Flux gandit pentru colaborare</p>
          <h2>Documente primite si trimise, grupate natural pe persoana si pachet.</h2>
        </div>
        <div className="steps">
          <span>1. Incarci documentele</span>
          <span>2. Creezi pachetul</span>
          <span>3. Alegi destinatarul</span>
          <span>4. Urmaresti statusul</span>
        </div>
      </section>

      <footer className="site-footer">
        <span>DocManager</span>
        <Link href="/legal/terms">Termeni si conditii</Link>
        <Link href="/legal/privacy">Politica de confidentialitate</Link>
        <Link href="/auth/forgot-password">Resetare parola</Link>
      </footer>
    </main>
  );
}
