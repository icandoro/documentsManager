import { AppShell } from "@/components/AppShell";
import { InstitutionsManager } from "@/components/InstitutionsManager";
import { LockKeyhole, ShieldCheck } from "lucide-react";

export default function ProfilePage() {
  return (
    <AppShell>
      <section className="page-head">
        <div>
          <p className="eyebrow">Cont si profil</p>
          <h1>Date utilizator</h1>
        </div>
      </section>
      <section className="profile-grid">
        <form className="panel form-grid">
          <h2>Date principale</h2>
          <div className="two-cols">
            <label>Nume<input defaultValue="Popescu" /></label>
            <label>Prenume<input defaultValue="Ion" /></label>
          </div>
          <div className="two-cols">
            <label>Telefon<input defaultValue="+40 700 000 000" /></label>
            <label>Email<input type="email" defaultValue="ion.popescu@example.com" /></label>
          </div>
          <div className="two-cols">
            <label>Limba<select defaultValue="ro"><option value="ro">Romana</option><option value="en">English</option></select></label>
            <label>Timezone<select defaultValue="Europe/Bucharest"><option>Europe/Bucharest</option><option>Europe/London</option></select></label>
          </div>
          <label>Tip persoana<select defaultValue="individual"><option value="individual">Persoana fizica</option><option value="company">Persoana juridica</option></select></label>
          <details>
            <summary>Campuri optionale</summary>
            <div className="two-cols details-grid">
              <label>Companie<input placeholder="Denumire companie" /></label>
              <label>CUI/CNP<input placeholder="Identificator fiscal" /></label>
              <label>Adresa<input placeholder="Strada, numar" /></label>
              <label>Oras<input placeholder="Bucuresti" /></label>
            </div>
          </details>
          <button className="primary-button" type="button">Salveaza profil</button>
        </form>

        <aside className="panel security-panel" id="security">
          <ShieldCheck size={32} />
          <h2>Security</h2>
          <p>Email si parola, sesiuni pe baza de token JWT si verificare 2FA pentru actiuni sensibile.</p>
          <div className="security-row"><LockKeyhole size={18} /> Parola configurata</div>
          <div className="security-row"><ShieldCheck size={18} /> 2FA recomandat</div>
          <button className="secondary-button">Configureaza 2FA</button>
        </aside>
      </section>
      <InstitutionsManager />
    </AppShell>
  );
}
