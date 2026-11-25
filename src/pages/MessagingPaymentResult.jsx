import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API_URL } from "../config/api";

export default function MessagingPaymentResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const propertyId = searchParams.get("propertyId");
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Vérification du paiement auprès de MTN Mobile Money...");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!propertyId) return undefined;

    let active = true;
    let timer;
    let checks = 0;

    const verifyPayment = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${API_URL}/property-payments/messaging/properties/${encodeURIComponent(propertyId)}/status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Impossible de vérifier le paiement.");
        }
        if (!active) return;

        if (data.paid) {
          const conversationResponse = await fetch(`${API_URL}/messages/conversations`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ propertyId: Number(propertyId) }),
          });
          const conversationData = await conversationResponse.json();

          if (!conversationResponse.ok) {
            throw new Error(conversationData.message || "Paiement confirmé, mais la conversation n'a pas pu être ouverte.");
          }
          if (active) navigate(`/messages/${conversationData.id}`, { replace: true });
          return;
        }

        if (data.status === "unpaid") {
          setStatus("unpaid");
          setMessage("Le paiement n'a pas été trouvé. Retournez à l'annonce pour réessayer.");
          return;
        }

        if (data.status === "failed") {
          setStatus("failed");
          setMessage("Le paiement MTN MoMo a échoué ou a été annulé. Retournez à l'annonce pour réessayer.");
          return;
        }

        checks += 1;
        if (checks >= 12) {
          setStatus("pending");
          setMessage("Le paiement est toujours en cours de confirmation. Vous pouvez vérifier à nouveau.");
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
  }, [propertyId, attempt, navigate]);

  const currentStatus = propertyId ? status : "error";
  const currentMessage = propertyId ? message : "Identifiant d'annonce manquant.";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <section className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Messagerie IMOVA
        </p>
        <h1 className="mb-4 text-2xl font-bold text-slate-900">
          Confirmation du paiement
        </h1>
        <p role={currentStatus === "error" ? "alert" : "status"} className="mb-6 text-slate-600">
          {currentMessage}
        </p>
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
            to={propertyId ? `/bien/${propertyId}` : "/biens"}
            className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Retour à l'annonce
          </Link>
        </div>
      </section>
    </main>
  );
}
