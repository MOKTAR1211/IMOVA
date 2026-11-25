import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API_URL } from "../config/api";

export default function PublicationPaymentResult() {
  const [searchParams] = useSearchParams();
  const propertyId = searchParams.get("propertyId");
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Vérification du paiement auprès de MTN Mobile Money...");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!propertyId) {
      return undefined;
    }

    let active = true;
    let timer;
    let checks = 0;

    const verifyPayment = async () => {
      try {
        const response = await fetch(
          `${API_URL}/property-payments/properties/${encodeURIComponent(propertyId)}/status`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Impossible de vérifier le paiement.");
        }

        if (!active) return;

        if (data.paid) {
          setStatus("paid");
          setMessage("Paiement confirmé : votre annonce est publiée automatiquement.");
          return;
        }

        if (data.status === "unpaid") {
          setStatus("unpaid");
          setMessage("Aucun paiement en cours n'a été trouvé pour cette annonce.");
          return;
        }

        if (data.status === "failed") {
          setStatus("failed");
          setMessage("Le paiement MTN MoMo a échoué ou a été annulé. Retournez à vos annonces pour réessayer.");
          return;
        }

        checks += 1;
        if (checks >= 12) {
          setStatus("pending");
          setMessage("Le paiement est encore en cours de confirmation. Vous pouvez réessayer la vérification.");
          return;
        }

        setStatus("checking");
        setMessage("Paiement en cours de confirmation...");
        timer = setTimeout(verifyPayment, 2500);
      } catch (error) {
        if (!active) return;
        setStatus("error");
        setMessage(error.message);
      }
    };

    verifyPayment();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [propertyId, attempt]);

  const currentStatus = propertyId ? status : "error";
  const currentMessage = propertyId ? message : "Identifiant d'annonce manquant.";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <section className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Publication IMOVA
        </p>
        <h1 className="mb-4 text-2xl font-bold text-slate-900">
          {currentStatus === "paid" ? "Paiement confirmé" : "Confirmation du paiement"}
        </h1>
        <p role={currentStatus === "error" ? "alert" : "status"} className="mb-6 text-slate-600">
          {currentMessage}
        </p>

        {currentStatus === "paid" ? (
          <Link
            to="/my-properties"
            className="inline-flex rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
          >
            Voir mes annonces
          </Link>
        ) : (
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {(currentStatus === "pending" || currentStatus === "error" || currentStatus === "failed") && (
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
              >
                Vérifier à nouveau
              </button>
            )}
            <Link
              to="/my-properties"
              className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Retour à mes annonces
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
