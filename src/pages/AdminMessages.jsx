import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Clock3, MessageCircle, Search, ShieldCheck } from "lucide-react";
import AdminModuleLayout from "../components/AdminModuleLayout";
import useSEO from "../utils/useSEO";
import { API_URL } from "../config/api";
import "./AdminModules.css";

const reasonLabels = {
  harassment: "Harcèlement",
  spam: "Spam",
  scam: "Arnaque",
  inappropriate: "Contenu inapproprié",
  other: "Autre",
};

function formatDate(value) {
  if (!value) return "Date indisponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date indisponible"
    : date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminMessages() {
  useSEO({ title: "Signalements de messagerie — IMOVA", noindex: true });
  const token = localStorage.getItem("token");
  const [reports, setReports] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("pending");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchReports = useCallback(async (signal) => {
    try {
      const params = new URLSearchParams({ status, search });
      const response = await fetch(`${API_URL}/admin/message-reports?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible de charger les signalements.");
      setError("");
      setReports(data);
    } catch (fetchError) {
      if (fetchError.name !== "AbortError") setError(fetchError.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [search, status, token]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) fetchReports(controller.signal);
    });
    return () => controller.abort();
  }, [fetchReports]);

  const openReport = async (id) => {
    setSelectedId(id);
    setDetail(null);
    setResolutionNote("");
    setError("");
    setDetailLoading(true);
    try {
      const response = await fetch(`${API_URL}/admin/message-reports/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible de charger la conversation signalée.");
      setDetail(data);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const resolveReport = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`${API_URL}/admin/message-reports/${selectedId}/resolve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resolutionNote }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible d'enregistrer la décision.");
      setSuccess(data.message);
      setSelectedId(null);
      setDetail(null);
      await fetchReports();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedReport = detail?.report;

  return (
    <AdminModuleLayout
      title="Modération des messages"
      eyebrow="CONFIDENTIALITÉ & SÉCURITÉ"
      description="La console n’affiche que les messages explicitement signalés par un participant. Les échanges privés non signalés, les pièces jointes et l’usurpation de compte restent hors d’accès."
    >
      {success && <div className="admin-module-alert is-success" role="status">{success}</div>}
      {error && <div className="admin-module-alert is-error" role="alert">{error}</div>}

      <section className="admin-module-card">
        <div className="admin-module-card-heading">
          <div>
            <span className="admin-module-kicker">FILE DE MODÉRATION</span>
            <h2><MessageCircle size={20} /> Signalements de conversations</h2>
          </div>
          <span className="admin-module-count">{reports.filter((report) => report.status === "pending").length} à traiter</span>
        </div>

        <div className="admin-module-filters admin-message-filters">
          <label className="admin-module-search">
            <Search size={17} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => { setLoading(true); setSearch(event.target.value); }} placeholder="Participants, annonce ou motif" />
          </label>
          <label>
            <span className="sr-only">État du signalement</span>
            <select value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value); }}>
              <option value="pending">À traiter</option>
              <option value="reviewed">Examinés</option>
              <option value="all">Tous les signalements</option>
            </select>
          </label>
        </div>

        {loading ? <p className="admin-module-loading">Chargement des signalements…</p> : reports.length === 0 ? (
          <div className="admin-module-empty">
            <ShieldCheck size={25} />
            <strong>Aucun signalement dans cette file</strong>
            <span>Les messages privés non signalés ne sont pas consultables ici.</span>
          </div>
        ) : (
          <div className="admin-message-reports">
            <div className="admin-message-report-list" aria-label="Signalements">
              {reports.map((report) => (
                <button
                  type="button"
                  key={report.id}
                  className={`admin-message-report-card${selectedId === report.id ? " is-selected" : ""}`}
                  onClick={() => openReport(report.id)}
                >
                  <span className={`admin-module-status status-${report.status === "pending" ? "pending" : "paid"}`}>
                    {report.status === "pending" ? "À traiter" : "Examiné"}
                  </span>
                  <strong>{report.reporter_name} a signalé un message</strong>
                  <span>{report.buyer_name} · {report.seller_name}</span>
                  <span>{report.property_title || "Conversation"}</span>
                  <small><AlertTriangle size={13} /> {reasonLabels[report.reason] || report.reason} · {formatDate(report.created_at)}</small>
                  {report.reported_message && <em>« {report.reported_message} »</em>}
                </button>
              ))}
            </div>

            <section className="admin-message-context" aria-live="polite">
              {!selectedId ? (
                <div className="admin-module-empty">
                  <MessageCircle size={25} />
                  <strong>Sélectionnez un signalement</strong>
                  <span>Le contexte de la conversation s’affichera ici.</span>
                </div>
              ) : detailLoading ? <p className="admin-module-loading">Chargement du contexte…</p> : selectedReport ? (
                <>
                  <div className="admin-message-context-heading">
                    <div><span className="admin-module-kicker">CONVERSATION SIGNALÉE</span><h3>{selectedReport.property_title || "Échange entre participants"}</h3></div>
                    <span className="admin-module-status status-pending">{reasonLabels[selectedReport.reason] || selectedReport.reason}</span>
                  </div>
                  <p className="admin-message-participants">
                    <strong>Participants</strong> {selectedReport.buyer_name} ({selectedReport.buyer_email}) · {selectedReport.seller_name} ({selectedReport.seller_email})
                  </p>
                  <p className="admin-message-reason">
                    <strong>Motif communiqué</strong>
                    {selectedReport.description || "Aucun détail complémentaire fourni."}
                  </p>
                  <div className="admin-message-context-list">
                    {detail.messages.map((message) => (
                      <article
                        key={message.id}
                        className={`admin-message-context-item${message.id === selectedReport.message_id ? " is-reported" : ""}`}
                      >
                        <div><strong>{message.sender_name}</strong><time>{formatDate(message.created_at)}</time></div>
                        <p>{message.content || (message.attachment_name ? `Pièce jointe : ${message.attachment_name}` : "Message sans texte")}</p>
                        {message.id === selectedReport.message_id && <span className="admin-message-reported-tag"><AlertTriangle size={12} /> Message signalé</span>}
                      </article>
                    ))}
                  </div>
                  {selectedReport.status === "pending" && (
                    <div className="admin-message-resolution">
                      <label htmlFor="admin-resolution-note">Note de décision (facultative)</label>
                      <textarea
                        id="admin-resolution-note"
                        rows="3"
                        maxLength="1000"
                        value={resolutionNote}
                        onChange={(event) => setResolutionNote(event.target.value)}
                        placeholder="Consignez brièvement l'examen effectué."
                      />
                      <button type="button" className="admin-module-primary-button" disabled={saving} onClick={resolveReport}>
                        <Check size={17} /> {saving ? "Enregistrement…" : "Marquer comme examiné"}
                      </button>
                    </div>
                  )}
                  {selectedReport.status === "reviewed" && (
                    <p className="admin-message-reviewed"><Clock3 size={15} /> Examiné le {formatDate(selectedReport.reviewed_at)}{selectedReport.resolution_note ? ` · ${selectedReport.resolution_note}` : ""}</p>
                  )}
                </>
              ) : null}
            </section>
          </div>
        )}
      </section>
    </AdminModuleLayout>
  );
}
