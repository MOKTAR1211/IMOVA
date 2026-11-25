import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, CreditCard, Search, X } from "lucide-react";
import AdminModuleLayout from "../components/AdminModuleLayout";
import useSEO from "../utils/useSEO";
import { API_URL } from "../config/api";
import "./AdminModules.css";

const money = (value, currency = "XOF") => (
  `${Number(value || 0).toLocaleString("fr-FR")} ${currency === "XOF" ? "FCFA" : currency}`
);

const paymentTypeLabel = (type) => (
  type === "publication" ? "Publication d'annonce" : "Accès messagerie"
);

const paymentMethodLabel = (method) => {
  if (method === "mtn_mobile_money") return "MTN Mobile Money";
  return "Non renseigné";
};

const paymentStatusLabel = (status) => ({
  pending: "En attente",
  paid: "Réussi",
  failed: "Échoué",
  refunded: "Remboursé",
}[String(status || "").toLowerCase()] || "Inconnu");

function formatDate(value) {
  if (!value) return "Date indisponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date indisponible"
    : date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminPayments() {
  useSEO({ title: "Gestion des paiements — IMOVA", noindex: true });
  const token = localStorage.getItem("token");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [method, setMethod] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ payments: [], total: 0, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: "25", status, type, method, search });

    fetch(`${API_URL}/admin/payments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Impossible de charger les paiements.");
        setError("");
        setData(result);
      })
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") setError(fetchError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [method, page, search, status, token, type]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
  const paidTotal = useMemo(
    () => data.payments.filter((payment) => payment.status === "paid")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [data.payments]
  );

  const openDetails = async (payment) => {
    setSelected({ ...payment, detailLoading: true });
    setDetailLoading(true);
    setDetailError("");
    try {
      const response = await fetch(
        `${API_URL}/admin/payments/${payment.payment_type}/${payment.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const detail = await response.json();
      if (!response.ok) throw new Error(detail.message || "Impossible de charger le détail.");
      setSelected(detail);
    } catch (detailFetchError) {
      setDetailError(detailFetchError.message);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <AdminModuleLayout
      title="Gestion des paiements"
      eyebrow="FINANCES & TRANSACTIONS"
      description="Historique en lecture seule des paiements réellement enregistrés. Les statuts financiers ne peuvent pas être modifiés depuis cette interface."
    >
      <section className="admin-module-stat-grid" aria-label="Résumé des transactions affichées">
        <article className="admin-module-stat">
          <span>Total des transactions filtrées</span>
          <strong>{data.total.toLocaleString("fr-FR")}</strong>
          <small>Données enregistrées en base</small>
        </article>
        <article className="admin-module-stat">
          <span>Montant réussi · page actuelle</span>
          <strong>{money(paidTotal)}</strong>
          <small>Somme des transactions réussies visibles</small>
        </article>
        <article className="admin-module-stat">
          <span>Source de paiement</span>
          <strong className="admin-module-stat-source"><CreditCard size={19} /> MTN & historique</strong>
          <small>Les paiements historiques sans méthode sont indiqués comme non renseignés</small>
        </article>
      </section>

      <section className="admin-module-card">
        <div className="admin-module-card-heading">
          <div>
            <span className="admin-module-kicker">JOURNAL FINANCIER</span>
            <h2>Transactions</h2>
          </div>
          <span className="admin-module-count">{data.total.toLocaleString("fr-FR")} résultat(s)</span>
        </div>
        <div className="admin-module-filters">
          <label className="admin-module-search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              placeholder="Nom, e-mail, annonce ou référence"
              onChange={(event) => {
                setLoading(true);
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            <span className="sr-only">Statut</span>
            <select value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value); setPage(1); }}>
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="paid">Réussi</option>
              <option value="failed">Échoué</option>
              <option value="refunded">Remboursé</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Type de paiement</span>
            <select value={type} onChange={(event) => { setLoading(true); setType(event.target.value); setPage(1); }}>
              <option value="all">Tous les types</option>
              <option value="publication">Publication d'annonce</option>
              <option value="messaging">Accès messagerie</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Moyen de paiement</span>
            <select value={method} onChange={(event) => { setLoading(true); setMethod(event.target.value); setPage(1); }}>
              <option value="all">Tous les moyens</option>
              <option value="mtn_mobile_money">MTN Mobile Money</option>
              <option value="unknown">Non renseigné</option>
            </select>
          </label>
        </div>

        {error && <div className="admin-module-alert is-error" role="alert">{error}</div>}
        <div className="admin-module-table-wrap">
          <table className="admin-module-table">
            <thead>
              <tr>
                <th scope="col">Client / propriétaire</th>
                <th scope="col">Type</th>
                <th scope="col">Montant</th>
                <th scope="col">Moyen</th>
                <th scope="col">Statut</th>
                <th scope="col">Date</th>
                <th scope="col"><span className="sr-only">Détails</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="admin-module-table-message">Chargement des transactions…</td></tr>
              ) : data.payments.length === 0 ? (
                <tr><td colSpan="7" className="admin-module-table-message">Aucun paiement ne correspond aux filtres.</td></tr>
              ) : data.payments.map((payment) => (
                <tr key={`${payment.payment_type}-${payment.id}`}>
                  <td>
                    <strong>{payment.payer_name || "Utilisateur"}</strong>
                    <small>{payment.payer_email || "E-mail indisponible"}</small>
                  </td>
                  <td><span className="admin-module-payment-type">{paymentTypeLabel(payment.payment_type)}</span><small>{payment.property_title || "Annonce supprimée"}</small></td>
                  <td className="admin-module-amount">{money(payment.amount, payment.currency)}</td>
                  <td>{paymentMethodLabel(payment.payment_method)}</td>
                  <td><span className={`admin-module-status status-${String(payment.status).toLowerCase()}`}>{paymentStatusLabel(payment.status)}</span></td>
                  <td><span className="admin-module-date"><CalendarClock size={14} />{formatDate(payment.created_at)}</span></td>
                  <td><button type="button" className="admin-module-details-button" onClick={() => openDetails(payment)}>Détails</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-module-pagination">
          <span>Page {page} sur {totalPages}</span>
          <div>
            <button type="button" aria-label="Page précédente" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((value) => value - 1); }}><ChevronLeft size={17} /></button>
            <button type="button" aria-label="Page suivante" disabled={page >= totalPages || loading} onClick={() => { setLoading(true); setPage((value) => value + 1); }}><ChevronRight size={17} /></button>
          </div>
        </div>
      </section>

      {selected && (
        <div className="admin-module-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="admin-module-detail-modal" role="dialog" aria-modal="true" aria-labelledby="payment-detail-title">
            <div className="admin-module-detail-heading">
              <div><span className="admin-module-kicker">CONSULTATION EN LECTURE SEULE</span><h2 id="payment-detail-title">Détail du paiement</h2></div>
              <button type="button" aria-label="Fermer le détail" onClick={() => setSelected(null)}><X size={20} /></button>
            </div>
            {detailLoading ? <p className="admin-module-loading">Chargement du détail…</p> : detailError ? <div className="admin-module-alert is-error" role="alert">{detailError}</div> : (
              <dl className="admin-module-detail-list">
                <div><dt>Référence</dt><dd>{selected.provider_transaction_id}</dd></div>
                <div><dt>Payeur</dt><dd>{selected.payer_name} · {selected.payer_email}{selected.payer_phone ? ` · ${selected.payer_phone}` : ""}</dd></div>
                <div><dt>Type de paiement</dt><dd>{paymentTypeLabel(selected.payment_type)}</dd></div>
                <div><dt>Bien concerné</dt><dd>{selected.property_title || "Annonce supprimée"}{selected.property_city ? ` · ${selected.property_city}` : ""}</dd></div>
                <div><dt>Montant</dt><dd>{money(selected.amount, selected.currency)}</dd></div>
                <div><dt>Moyen de paiement</dt><dd>{paymentMethodLabel(selected.payment_method)}</dd></div>
                <div><dt>Statut</dt><dd><span className={`admin-module-status status-${String(selected.status).toLowerCase()}`}>{paymentStatusLabel(selected.status)}</span></dd></div>
                <div><dt>Créé le</dt><dd>{formatDate(selected.created_at)}</dd></div>
                <div><dt>Dernière mise à jour</dt><dd>{formatDate(selected.updated_at)}</dd></div>
              </dl>
            )}
          </section>
        </div>
      )}
    </AdminModuleLayout>
  );
}
