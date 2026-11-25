import React, { useCallback, useEffect, useState, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import {
  ArrowLeft,
  Archive,
  CheckCheck,
  Circle,
  Flag,
  Home,
  Image,
  Info,
  MapPin,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  Smile,
  X,
} from "lucide-react";
import { API_BASE_URL, API_URL } from "../config/api";
import Navbar from "../components/Navbar";
import "./Messages.css";

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";
}

function formatConversationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function formatMessageDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Aujourd’hui";
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatPropertyPrice(value) {
  if (value === null || value === undefined || value === "") return "";
  return `${Number(value).toLocaleString("fr-FR")} FCFA`;
}

const messageEmojis = ["😀", "😊", "😂", "😍", "👍", "🙏", "🎉", "❤️", "🏠", "🤝"];

function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [conversationFilter, setConversationFilter] = useState("all");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [recentCutoff] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [typingState, setTypingState] = useState({ conversationId: null, userId: null, typing: false });
  const [composerState, setComposerState] = useState({
    conversationId: null,
    isEmojiPickerOpen: false,
    attachment: null,
    attachmentError: "",
  });
  const [attachmentUrls, setAttachmentUrls] = useState({});
  const [reportingMessage, setReportingMessage] = useState(null);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDescription, setReportDescription] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSuccess, setReportSuccess] = useState("");

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const otherTypingTimeoutRef = useRef(null);
  const typingActiveRef = useRef(false);
  const attachmentInputRef = useRef(null);
  const attachmentUrlsRef = useRef(new Map());
  const pendingAttachmentIdsRef = useRef(new Set());

  const token = localStorage.getItem("token");
  const [currentUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });
  const currentUserId = currentUser?.id;
  const isOwner = currentUser?.role === "proprietaire";
  const conversationKey = String(conversationId);
  const activeComposerState = String(composerState.conversationId) === conversationKey
    ? composerState
    : { isEmojiPickerOpen: false, attachment: null, attachmentError: "" };
  const isEmojiPickerOpen = activeComposerState.isEmojiPickerOpen;
  const attachment = activeComposerState.attachment;
  const attachmentError = activeComposerState.attachmentError;
  const isOtherTyping = String(typingState.conversationId) === conversationKey
    && String(typingState.userId) !== String(currentUserId)
    && typingState.typing;

  const updateComposerState = (updates) => {
    setComposerState((previous) => {
      const current = String(previous.conversationId) === conversationKey
        ? previous
        : {
          conversationId: conversationKey,
          isEmojiPickerOpen: false,
          attachment: null,
          attachmentError: "",
        };
      return {
        ...current,
        ...(typeof updates === "function" ? updates(current) : updates),
        conversationId: conversationKey,
      };
    });
  };

  // Rediriger vers login si non connecté
  useEffect(() => {
    if (!token) {
      navigate("/connexion");
    }
  }, [token, navigate]);

  // 1. Initialisation de Socket.IO
  useEffect(() => {
    if (!token) return;

    const socket = io(API_BASE_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      if (conversationId) {
        socket.emit("join:conversation", conversationId);
      }
    });

    socket.on("conversation:typing", ({ conversationId: typingConversationId, userId, typing } = {}) => {
      if (
        String(typingConversationId) === String(conversationId)
        && String(userId) !== String(currentUserId)
      ) {
        setTypingState({
          conversationId: String(typingConversationId),
          userId: String(userId),
          typing: Boolean(typing),
        });
        if (otherTypingTimeoutRef.current) clearTimeout(otherTypingTimeoutRef.current);
        if (typing) {
          const currentConversationId = String(typingConversationId);
          const currentUserId = String(userId);
          otherTypingTimeoutRef.current = setTimeout(() => {
            setTypingState((previous) => (
              String(previous.conversationId) === currentConversationId
              && String(previous.userId) === currentUserId
                ? { ...previous, typing: false }
                : previous
            ));
          }, 3500);
        }
      }
    });

    // Liste des utilisateurs déjà connectés
    socket.on("users:online", (list) => {
      if (Array.isArray(list)) {
        const statusMap = {};
        list.forEach((uid) => {
          statusMap[String(uid)] = true;
        });
        setOnlineUsers((prev) => ({
          ...prev,
          ...statusMap,
        }));
      }
    });

    // Statut en ligne / hors ligne dynamique
    socket.on("user:status", ({ userId, online }) => {
      setOnlineUsers((previous) => ({
        ...previous,
        [String(userId)]: online,
      }));
    });

    // Confirmation de lecture "Vu"
    socket.on("message:read", ({ conversationId: readConvoId }) => {
      if (String(readConvoId) === String(conversationId)) {
        setMessages((previous) =>
          previous.map((m) =>
            String(m.sender_id) === String(currentUserId)
              ? { ...m, is_read: true }
              : m
          )
        );
      }
    });

    // Écouter les nouveaux messages en temps réel
    socket.on("message:new", (msg) => {
      const msgConvoId = msg.conversation_id || msg.conversationId;

      // Si le message appartient à la conversation active, l'ajouter
      if (conversationId && Number(msgConvoId) === Number(conversationId)) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }

      // Mettre à jour la liste des conversations
      setConversations((prev) =>
        prev.map((c) => {
          if (Number(c.id) === Number(msgConvoId)) {
            const isMine = Number(msg.sender_id) === Number(currentUserId);
            return {
              ...c,
              lastMessage: msg.content || (msg.attachmentUrl ? "Photo jointe" : ""),
              lastMessageDate: msg.created_at,
              unreadCount:
                isMine || Number(conversationId) === Number(msgConvoId)
                  ? 0
                  : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );
    });

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (otherTypingTimeoutRef.current) {
        clearTimeout(otherTypingTimeoutRef.current);
      }
      if (typingActiveRef.current && conversationId) {
        socket.emit("conversation:typing", { conversationId, typing: false });
      }
      typingActiveRef.current = false;
      socket.off("user:status");
      socket.off("users:online");
      socket.off("message:read");
      socket.off("message:new");
      socket.off("conversation:typing");
      socket.disconnect();
    };
  }, [token, conversationId, currentUserId]);

  useEffect(() => {
    const controller = new AbortController();
    const requestedIds = [];
    const activeAttachmentUrls = attachmentUrlsRef.current;
    const pendingAttachmentIds = pendingAttachmentIdsRef.current;

    messages.forEach((message) => {
      const messageId = String(message.id);
      if (
        !message.attachmentUrl
        || activeAttachmentUrls.has(messageId)
        || pendingAttachmentIds.has(messageId)
      ) {
        return;
      }

      pendingAttachmentIds.add(messageId);
      requestedIds.push(messageId);
      fetch(`${API_BASE_URL}${message.attachmentUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).then((response) => {
        if (!response.ok) {
          throw new Error("Impossible de charger cette image.");
        }
        return response.blob();
      }).then((blob) => {
        if (controller.signal.aborted) return;
        const objectUrl = URL.createObjectURL(blob);
        activeAttachmentUrls.set(messageId, objectUrl);
        setAttachmentUrls((previous) => ({ ...previous, [messageId]: objectUrl }));
      }).catch((loadError) => {
        if (loadError.name !== "AbortError") {
          console.error("Erreur chargement image de messagerie :", loadError.message);
        }
      }).finally(() => {
        pendingAttachmentIdsRef.current.delete(messageId);
      });
    });

    return () => {
      controller.abort();
      requestedIds.forEach((messageId) => pendingAttachmentIds.delete(messageId));
    };
  }, [messages, conversationId, token]);

  useEffect(() => {
    const activeAttachmentUrls = attachmentUrlsRef.current;
    return () => {
      activeAttachmentUrls.forEach((url) => URL.revokeObjectURL(url));
      activeAttachmentUrls.clear();
    };
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (typingActiveRef.current && conversationId && socketRef.current?.connected) {
      socketRef.current.emit("conversation:typing", { conversationId, typing: false });
    }
    typingActiveRef.current = false;
  }, [conversationId]);

  const handleMessageChange = (event) => {
    setNewMessage(event.target.value);
    const socket = socketRef.current;
    if (!socket?.connected || !conversationId) return;

    if (!typingActiveRef.current) {
      socket.emit("conversation:typing", { conversationId, typing: true });
      typingActiveRef.current = true;
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 1200);
  };

  const handleAttachmentSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    updateComposerState({ attachmentError: "" });
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      updateComposerState({ attachmentError: "Choisissez une image JPG, PNG ou WEBP." });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      updateComposerState({ attachmentError: "L’image doit faire 3 Mo maximum." });
      return;
    }
    updateComposerState({ attachment: file });
  };

  const insertEmoji = (emoji) => {
    setNewMessage((previous) => `${previous}${emoji}`);
    updateComposerState({ isEmojiPickerOpen: false });
  };

  // Défilement automatique vers le bas
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 2. Charger toutes les conversations
  const fetchConversations = useCallback(async () => {
    try {
      if (!token) return;
      const res = await fetch(`${API_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Impossible de récupérer les conversations.");
      }

      const data = await res.json();
      setConversations(data);

      // Si un conversationId est présent dans l'URL, trouver la conversation active
      if (conversationId) {
        const found = data.find((c) => String(c.id) === String(conversationId));
        if (found) {
          setActiveConversation(found);
        } else {
          setActiveConversation(null);
        }
      } else {
        setActiveConversation(null);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, conversationId]);

  // Conversation state is synchronized from the asynchronous API response.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    fetchConversations();
  }, [fetchConversations]);

  // 3. Charger les messages quand la conversation change
  useEffect(() => {
    if (!conversationId || !token) return;

    const loadConversationDetails = async () => {
      try {
        setError(null);
        const res = await fetch(`${API_URL}/messages/conversations/${conversationId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Erreur de chargement des messages.");
        }

        const data = await res.json();
        setActiveConversation(data.conversation);
        setMessages(data.messages || []);

        // Mettre à jour l'état unread dans la liste
        setConversations((prev) =>
          prev.map((c) =>
            String(c.id) === String(conversationId)
              ? { ...c, unreadCount: 0 }
              : c
          )
        );

        // Informer le socket de la salle de conversation
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit("join:conversation", conversationId);
        }
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    };

    loadConversationDetails();

    return () => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("leave:conversation", conversationId);
      }
    };
  }, [conversationId, token]);

  // 4. Envoyer un message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !attachment) || !conversationId || sending) return;

    const content = newMessage.trim();
    const selectedAttachment = attachment;
    setSending(true);
    stopTyping();

    try {
      const requestBody = selectedAttachment
        ? (() => {
          const formData = new FormData();
          formData.append("content", content);
          formData.append("attachment", selectedAttachment);
          return formData;
        })()
        : JSON.stringify({ content });
      const res = await fetch(`${API_URL}/messages/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: {
          ...(selectedAttachment ? {} : { "Content-Type": "application/json" }),
          Authorization: `Bearer ${token}`,
        },
        body: requestBody,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Échec de l'envoi du message.");
      }

      const savedMessage = await res.json();

      // Mettre à jour la liste des messages localement si pas déjà reçue par socket
      setMessages((prev) => {
        if (prev.some((m) => m.id === savedMessage.id)) return prev;
        return [...prev, savedMessage];
      });

      // Mettre à jour l'aperçu de la conversation
      setConversations((prev) =>
        prev.map((c) =>
          String(c.id) === String(conversationId)
            ? {
              ...c,
              lastMessage: content || (savedMessage.attachmentUrl ? "Photo jointe" : ""),
              lastMessageDate: savedMessage.created_at || new Date().toISOString(),
            }
            : c
        )
      );

      setNewMessage("");
      updateComposerState({
        attachment: null,
        attachmentError: "",
        isEmojiPickerOpen: false,
      });
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  async function archiveConversation(id) {
    const confirmed = window.confirm("Masquer cette conversation ?");
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/messages/conversations/${id}/archive`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Impossible de masquer la conversation.");
      }

      // Retirer la conversation de la liste localement
      setConversations((prev) => prev.filter((c) => String(c.id) !== String(id)));

      // Naviguer vers /messages si la conversation masquée était active
      if (String(conversationId) === String(id)) {
        setActiveConversation(null);
        setMessages([]);
        navigate("/messages");
      }
    } catch (err) {
      alert(err.message);
    }
  }

  async function submitMessageReport(event) {
    event.preventDefault();
    if (!reportingMessage || !conversationId || reporting) return;

    setReporting(true);
    setReportError("");
    try {
      const response = await fetch(`${API_URL}/messages/conversations/${conversationId}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messageId: reportingMessage.id,
          reason: reportReason,
          description: reportDescription,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Impossible d'envoyer le signalement.");
      setReportingMessage(null);
      setReportDescription("");
      setReportSuccess("Le message a été transmis à l'équipe de modération.");
      window.setTimeout(() => setReportSuccess(""), 5000);
    } catch (submitError) {
      setReportError(submitError.message);
    } finally {
      setReporting(false);
    }
  }

  const filteredConversations = conversations.filter((c) => {
    const search = searchTerm.trim().toLowerCase();
    const name = [c.first_name || "", c.last_name || "", c.otherUser?.nom || ""]
      .join(" ")
      .toLowerCase();
    const matchesSearch = name.includes(search)
      || (c.propertyTitle || "").toLowerCase().includes(search)
      || (c.lastMessage || "").toLowerCase().includes(search);
    const isRecent = new Date(c.lastMessageDate || c.created_at).getTime() >= recentCutoff;
    return matchesSearch
      && (conversationFilter === "all"
        || (conversationFilter === "unread" && c.unreadCount > 0)
        || (conversationFilter === "recent" && isRecent));
  });

  return (
    <div>
      <Navbar />

      <main className="messages-page">
        <div className="messages-heading">
          <div>
            <span className="messages-eyebrow">ESPACE PRIVÉ</span>
            <h1>{isOwner ? "Vos échanges avec les clients" : "Votre messagerie"}</h1>
            <p>Échangez simplement autour de vos projets immobiliers.</p>
          </div>
          <div className="messages-secure-note">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>Conversation sécurisée</span>
          </div>
        </div>

        {error && <div className="messages-error" role="alert">{error}</div>}

        <div className={`messages-layout ${conversationId ? "has-active-conversation" : ""}${isInfoOpen ? " has-info-open" : ""}`}>
          {/* Barre latérale des conversations */}
          <aside className="conversation-sidebar">
            <div className="conversation-sidebar-heading">
              <div>
                <h2>Messages</h2>
                <p>{conversations.length} échange{conversations.length === 1 ? "" : "s"}</p>
              </div>
              <span className="messages-heading-icon"><MessageCircle size={18} /></span>
            </div>

            <label className="conversation-search">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                placeholder="Rechercher un échange"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Rechercher une conversation"
              />
              {searchTerm && (
                <button type="button" className="clear-search" onClick={() => setSearchTerm("")} aria-label="Effacer la recherche">
                  ×
                </button>
              )}
            </label>

            <div className="conversation-filters" role="group" aria-label="Filtrer les conversations">
              {[
                ["all", "Toutes"],
                ["unread", "Non lues"],
                ["recent", "Récentes"],
              ].map(([filter, label]) => (
                <button
                  type="button"
                  key={filter}
                  className={conversationFilter === filter ? "active" : ""}
                  aria-pressed={conversationFilter === filter}
                  onClick={() => setConversationFilter(filter)}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="conversation-loading" role="status">
                <span className="loading-dot" />
                Chargement des conversations…
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="conversation-empty">
                <span className="empty-icon"><MessageCircle size={22} /></span>
                <strong>{searchTerm || conversationFilter !== "all" ? "Aucun résultat" : "Pas encore de conversation"}</strong>
                <p>
                  {searchTerm || conversationFilter !== "all"
                    ? "Essayez un autre nom ou effacez votre recherche."
                    : isOwner
                      ? "Les messages des clients intéressés par vos biens apparaîtront ici."
                      : "Contactez un propriétaire depuis une annonce pour démarrer un échange."}
                </p>
              </div>
            ) : (
              <div className="conversation-list">
                {filteredConversations.map((c) => {
                  const isActive = String(conversationId) === String(c.id);
                  const name = c.otherUser?.nom || "Interlocuteur";
                  return (
                    <div key={c.id} className={`conversation-item ${isActive ? "active" : ""}`}>
                      <button
                        type="button"
                        className="conversation-link"
                        onClick={() => navigate(`/messages/${c.id}`)}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <span className="conversation-avatar">{getInitials(name)}</span>
                        <span className="conversation-details">
                          <span className="conversation-card-header">
                            <strong>{name}</strong>
                            <time>{formatConversationTime(c.lastMessageDate || c.created_at)}</time>
                          </span>
                          {c.propertyTitle && (
                            <span className="conversation-property">
                              <Home size={13} aria-hidden="true" /> {c.propertyTitle}
                            </span>
                          )}
                          <span className="conversation-preview">
                            {c.last_message || c.lastMessage || "Démarrer la conversation"}
                          </span>
                          {onlineUsers[String(c.otherUser?.id)] && (
                            <span className="conversation-online"><i /> En ligne</span>
                          )}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="conversation-unread" aria-label={`${c.unreadCount} message(s) non lu(s)`}>
                            {c.unreadCount}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        className="archive-btn"
                        title="Masquer cette conversation"
                        aria-label={`Masquer la conversation avec ${name}`}
                        onClick={() => archiveConversation(c.id)}
                      >
                        <Archive size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* Volet de discussion principal */}
          {activeConversation ? (
            <section className="chat-panel">
              <header className="chat-header">
                <button type="button" className="mobile-back-button" onClick={() => navigate("/messages")} aria-label="Retour aux conversations">
                  <ArrowLeft size={19} />
                </button>
                <span className="chat-avatar">
                  {getInitials(activeConversation.otherUser?.nom || "Conversation")}
                  <span className={`presence-indicator ${onlineUsers[String(activeConversation.otherUser?.id)] ? "online" : ""}`} />
                </span>
                <div className="chat-header-details">
                  <h2>{activeConversation.otherUser?.nom || "Conversation"}</h2>
                  <p className="chat-presence">
                    <Circle size={8} fill="currentColor" />
                    {onlineUsers[String(activeConversation.otherUser?.id)] ? "En ligne" : "Hors ligne"}
                    {activeConversation.otherUser?.role && (
                      <span className="chat-role">
                        · {activeConversation.otherUser.role === "proprietaire" ? "Propriétaire" : "Client"}
                      </span>
                    )}
                  </p>
                </div>
                <div className="chat-header-context">
                  <span>À PROPOS DE</span>
                  {activeConversation.propertyTitle
                    ? <strong><Home size={15} />{activeConversation.propertyTitle}</strong>
                    : <strong>Échange privé</strong>}
                </div>
                <button
                  type="button"
                  className="chat-more-button"
                  title="Informations sur l’échange"
                  aria-label="Afficher les informations sur l’échange"
                  aria-expanded={isInfoOpen}
                  onClick={() => setIsInfoOpen((open) => !open)}
                >
                  <Info size={18} />
                </button>
              </header>

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-empty">
                    <span className="empty-icon"><MessageCircle size={24} /></span>
                    <strong>La conversation commence ici</strong>
                    <p>Envoyez un message pour démarrer votre échange.</p>
                  </div>
                ) : (
                  messages.map((m, index) => {
                    const isMine = String(m.sender_id) === String(currentUserId);
                    const currentDate = formatMessageDate(m.created_at);
                    const previousDate = index > 0 ? formatMessageDate(messages[index - 1].created_at) : null;
                    return (
                      <React.Fragment key={m.id || m.created_at}>
                        {currentDate !== previousDate && (
                          <div className="message-date-separator"><span>{currentDate}</span></div>
                        )}
                        <div className={`chat-message ${isMine ? "mine" : ""}`}>
                          {!isMine && <span className="message-sender">{activeConversation.otherUser?.nom || "Interlocuteur"}</span>}
                          {m.content && <p>{m.content}</p>}
                          {m.attachmentUrl && (
                            attachmentUrls[String(m.id)] ? (
                              <a
                                className="message-attachment"
                                href={attachmentUrls[String(m.id)]}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Ouvrir l’image ${m.attachmentName || "jointe"}`}
                              >
                                <img
                                  src={attachmentUrls[String(m.id)]}
                                  alt={m.attachmentName || "Image partagée dans la conversation"}
                                  loading="lazy"
                                />
                              </a>
                            ) : (
                              <span className="attachment-loading">Chargement de l’image…</span>
                            )
                          )}
                          <time>
                            {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                          {isMine && (
                            <small className="message-status">
                              {m.is_read ? <><CheckCheck size={14} /> Lu</> : "Envoyé"}
                            </small>
                          )}
                          {!isMine && ["client", "proprietaire"].includes(currentUser?.role) && (
                            <button
                              type="button"
                              className="message-report-button"
                              onClick={() => {
                                setReportError("");
                                setReportingMessage(m);
                              }}
                              aria-label="Signaler ce message"
                            >
                              <Flag size={13} aria-hidden="true" /> Signaler
                            </button>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                {isOtherTyping && (
                  <div className="typing-indicator" role="status" aria-label="Votre interlocuteur écrit">
                    <span><i /><i /><i /></span>
                    <small>{activeConversation.otherUser?.nom || "Votre interlocuteur"} écrit…</small>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="chat-compose" onSubmit={handleSendMessage}>
                {attachment && (
                  <div className="attachment-preview">
                    <span className="attachment-preview-icon"><Image size={17} /></span>
                    <span>
                      <strong>{attachment.name}</strong>
                      <small>{(attachment.size / (1024 * 1024)).toFixed(2)} Mo · image jointe</small>
                    </span>
                    <button type="button" onClick={() => updateComposerState({ attachment: null })} aria-label="Retirer l’image jointe">
                      <X size={16} />
                    </button>
                  </div>
                )}
                {attachmentError && <p className="attachment-error" role="alert">{attachmentError}</p>}
                <div className="compose-field">
                  <textarea
                    value={newMessage}
                    onChange={handleMessageChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Écrivez votre message…"
                    rows={1}
                    maxLength={5000}
                    aria-label="Votre message"
                  />
                </div>
                <div className="compose-footer">
                  <div className="compose-tools">
                    <input
                      ref={attachmentInputRef}
                      className="attachment-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      onChange={handleAttachmentSelect}
                      aria-label="Joindre une image"
                    />
                    <button
                      type="button"
                      className="compose-tool-button"
                      onClick={() => attachmentInputRef.current?.click()}
                      title="Joindre une image (3 Mo maximum)"
                      aria-label="Joindre une image"
                    >
                      <Paperclip size={17} />
                    </button>
                    <div className="emoji-picker-container">
                      <button
                        type="button"
                        className={`compose-tool-button ${isEmojiPickerOpen ? "selected" : ""}`}
                        onClick={() => updateComposerState((previous) => ({
                          isEmojiPickerOpen: !previous.isEmojiPickerOpen,
                        }))}
                        aria-label="Choisir un emoji"
                        aria-expanded={isEmojiPickerOpen}
                      >
                        <Smile size={18} />
                      </button>
                      {isEmojiPickerOpen && (
                        <div className="emoji-picker" role="group" aria-label="Emojis">
                          {messageEmojis.map((emoji) => (
                            <button
                              type="button"
                              key={emoji}
                              onClick={() => insertEmoji(emoji)}
                              aria-label={`Ajouter ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="compose-hint">Entrée pour envoyer · Maj + Entrée pour une ligne</span>
                  </div>
                  <button type="submit" disabled={(!newMessage.trim() && !attachment) || sending} aria-label="Envoyer le message">
                    {sending ? <span className="send-spinner" /> : <Send size={17} />}
                    <span>{sending ? "Envoi…" : "Envoyer"}</span>
                  </button>
                </div>
              </form>
            </section>
          ) : (
            <div className="chat-placeholder">
              <span className="placeholder-icon"><MessageCircle size={30} /></span>
              <span className="messages-eyebrow">VOTRE MESSAGERIE</span>
              <h2>Vos conversations</h2>
              <p>
                {conversations.length
                  ? "Sélectionnez une conversation pour commencer à échanger avec un client ou un propriétaire."
                  : isOwner
                    ? "Les clients intéressés par vos annonces pourront vous écrire ici."
                    : "Contactez un propriétaire depuis une annonce pour commencer à échanger."}
              </p>
              {!isOwner && conversations.length === 0 && (
                <Link to="/biens" className="messages-dashboard-link">
                  Explorer les annonces
                </Link>
              )}
              {isOwner && conversations.length === 0 && (
                <Link to="/property-dashboard" className="messages-dashboard-link">
                  Retour à mon espace propriétaire
                </Link>
              )}
            </div>
          )}
          {isInfoOpen && activeConversation && (
            <aside className="conversation-info" aria-label="Informations sur la conversation">
              <div className="conversation-info-heading">
                <div>
                  <span className="messages-eyebrow">DÉTAILS</span>
                  <h2>À propos</h2>
                </div>
                <button type="button" onClick={() => setIsInfoOpen(false)} aria-label="Fermer les informations">
                  <X size={18} />
                </button>
              </div>
              <div className="info-person">
                <span className="info-avatar">{getInitials(activeConversation.otherUser?.nom || "Interlocuteur")}</span>
                <strong>{activeConversation.otherUser?.nom || "Interlocuteur"}</strong>
                <span>{activeConversation.otherUser?.role === "proprietaire" ? "Propriétaire" : "Client"}</span>
              </div>
              {activeConversation.propertyTitle && (
                <section className="info-property">
                  {activeConversation.propertyImage ? (
                    <img src={activeConversation.propertyImage} alt="" loading="lazy" />
                  ) : (
                    <div className="info-property-placeholder"><Home size={24} /></div>
                  )}
                  <div className="info-property-content">
                    <span className="messages-eyebrow">BIEN CONCERNÉ</span>
                    <h3>{activeConversation.propertyTitle}</h3>
                    {(activeConversation.propertyCity || activeConversation.propertyNeighborhood) && (
                      <p><MapPin size={14} /> {[activeConversation.propertyNeighborhood, activeConversation.propertyCity].filter(Boolean).join(", ")}</p>
                    )}
                    {activeConversation.propertyPrice !== null && activeConversation.propertyPrice !== undefined && (
                      <strong>{formatPropertyPrice(activeConversation.propertyPrice)}</strong>
                    )}
                    {activeConversation.propertyStatus && (
                      <span className="property-status">{activeConversation.propertyStatus}</span>
                    )}
                    <Link to={`/bien/${activeConversation.propertyId}`} className="view-property-link">
                      Voir l’annonce <Home size={14} />
                    </Link>
                  </div>
                </section>
              )}
            </aside>
          )}
        </div>
      </main>
      {reportSuccess && <div className="message-report-success" role="status">{reportSuccess}</div>}
      {reportingMessage && (
        <div
          className="message-report-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reporting) setReportingMessage(null);
          }}
        >
          <form className="message-report-dialog" role="dialog" aria-modal="true" aria-labelledby="message-report-title" onSubmit={submitMessageReport}>
            <div className="message-report-heading">
              <span><Flag size={18} aria-hidden="true" /></span>
              <button type="button" aria-label="Fermer le signalement" disabled={reporting} onClick={() => setReportingMessage(null)}><X size={19} /></button>
            </div>
            <h2 id="message-report-title">Signaler ce message</h2>
            <p>Votre signalement sera examiné par l'équipe IMOVA. La conversation n'est visible par l'administration qu'après avoir été signalée.</p>
            <label>
              Motif
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
                <option value="harassment">Harcèlement</option>
                <option value="spam">Spam</option>
                <option value="scam">Arnaque ou fraude</option>
                <option value="inappropriate">Contenu inapproprié</option>
                <option value="other">Autre</option>
              </select>
            </label>
            <label>
              Détails (facultatif)
              <textarea value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} maxLength={1000} rows={3} />
            </label>
            {reportError && <p className="message-report-error" role="alert">{reportError}</p>}
            <div className="message-report-actions">
              <button type="button" disabled={reporting} onClick={() => setReportingMessage(null)}>Annuler</button>
              <button type="submit" disabled={reporting}>{reporting ? "Envoi…" : "Envoyer le signalement"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Messages;
