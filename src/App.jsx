import React, { Suspense, lazy } from "react";
import {
  BrowserRouter,
  Navigate,
  Routes,
  Route
} from "react-router-dom";

// Code-splitting dynamique (chargement à la demande de chaque page)
const Home = lazy(() => import("./pages/Home"));
const Properties = lazy(() => import("./pages/Properties"));
const PropertyDetails = lazy(() => import("./pages/PropertyDetails"));
const Register = lazy(() => import("./pages/Register"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AddProperty = lazy(() => import("./pages/AddProperty"));
const EditProperty = lazy(() => import("./pages/EditProperty"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminPayments = lazy(() => import("./pages/AdminPayments"));
const AdminMessages = lazy(() => import("./pages/AdminMessages"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));

const Favorites = lazy(() => import("./pages/Favorites"));
const Messages = lazy(() => import("./pages/Messages"));
const MyVisits = lazy(() => import("./pages/MyVisits"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const MyProperties = lazy(() => import("./pages/MyProperties"));
const PropertyDashboard = lazy(() => import("./pages/PropertyDashboard"));
const PropertyCharts = lazy(() => import("./pages/PropertyCharts"));
const ActivityStats = lazy(() => import("./pages/ActivityStats"));
const AdvancedSearch = lazy(() => import("./pages/AdvancedSearch"));
const PropertyMap = lazy(() => import("./pages/PropertyMap"));
const NearbyProperties = lazy(() => import("./pages/NearbyProperties"));
const Profile = lazy(() => import("./pages/Profile"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const PublicationPaymentResult = lazy(() => import("./pages/PublicationPaymentResult"));
const MessagingPaymentResult = lazy(() => import("./pages/MessagingPaymentResult"));
const Contact = lazy(() => import("./pages/Contact"));
const APropos = lazy(() => import("./pages/APropos"));

const PageLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600">
    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="text-sm font-medium text-slate-500">Chargement d'IMOVA...</p>
  </div>
);

const getStoredUser = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const ProtectedRoleRoute = ({ children, allowedRoles }) => {
  const user = getStoredUser();

  if (!user) {
    return <Navigate to="/connexion" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    const fallbackPath =
      user.role === "admin"
        ? "/admin"
        : user.role === "proprietaire"
          ? "/property-dashboard"
          : "/dashboard";

    return <Navigate to={fallbackPath} replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>

        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/biens"
          element={<Properties />}
        />

        <Route
          path="/properties"
          element={<Properties />}
        />

        <Route
          path="/bien/:id"
          element={<PropertyDetails />}
        />

        <Route
          path="/properties/:id"
          element={<PropertyDetails />}
        />

        <Route
          path="/advanced-search"
          element={<AdvancedSearch />}
        />
        <Route
          path="/recherche-avancee"
          element={<AdvancedSearch />}
        />

        <Route
          path="/property-map"
          element={<PropertyMap />}
        />
        <Route
          path="/carte"
          element={<PropertyMap />}
        />

        <Route
          path="/nearby-properties"
          element={<NearbyProperties />}
        />
        <Route
          path="/proximite"
          element={<NearbyProperties />}
        />

        <Route
          path="/favoris"
          element={
            <ProtectedRoleRoute allowedRoles={["client"]}>
              <Favorites />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/favorites"
          element={
            <ProtectedRoleRoute allowedRoles={["client"]}>
              <Favorites />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/messages"
          element={
            <ProtectedRoleRoute allowedRoles={["client", "proprietaire"]}>
              <Messages />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/messages/:conversationId"
          element={
            <ProtectedRoleRoute allowedRoles={["client", "proprietaire"]}>
              <Messages />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/inscription"
          element={<Register />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/connexion"
          element={<Login />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/reinitialiser-mot-de-passe"
          element={<ResetPassword />}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoleRoute allowedRoles={["client"]}>
              <Dashboard />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/ajouter-bien"
          element={
            <ProtectedRoleRoute allowedRoles={["proprietaire"]}>
              <AddProperty />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/add-property"
          element={
            <ProtectedRoleRoute allowedRoles={["proprietaire"]}>
              <AddProperty />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/modifier-bien/:id"
          element={
            <ProtectedRoleRoute allowedRoles={["proprietaire"]}>
              <EditProperty />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/edit-property/:id"
          element={
            <ProtectedRoleRoute allowedRoles={["proprietaire"]}>
              <EditProperty />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/my-properties"
          element={
            <ProtectedRoleRoute allowedRoles={["proprietaire"]}>
              <MyProperties />
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/mes-annonces"
          element={
            <ProtectedRoleRoute allowedRoles={["proprietaire"]}>
              <MyProperties />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/property-dashboard"
          element={
            <ProtectedRoleRoute allowedRoles={["proprietaire"]}>
              <PropertyDashboard />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/publication/paiement"
          element={
            <ProtectedRoleRoute allowedRoles={["proprietaire"]}>
              <PublicationPaymentResult />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/messagerie/paiement"
          element={
            <ProtectedRoleRoute allowedRoles={["client"]}>
              <MessagingPaymentResult />
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/tableau-de-bord-immobilier"
          element={
            <ProtectedRoleRoute allowedRoles={["proprietaire"]}>
              <PropertyDashboard />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/property-charts"
          element={
            <ProtectedRoleRoute allowedRoles={["proprietaire"]}>
              <PropertyCharts />
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/graphiques-immobilier"
          element={
            <ProtectedRoleRoute allowedRoles={["proprietaire"]}>
              <PropertyCharts />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/activity-stats"
          element={
            <ProtectedRoleRoute allowedRoles={["proprietaire"]}>
              <ActivityStats />
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/statistiques-activite"
          element={
            <ProtectedRoleRoute allowedRoles={["proprietaire"]}>
              <ActivityStats />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoleRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <ProtectedRoleRoute allowedRoles={["admin"]}>
              <AdminPayments />
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/admin/messages"
          element={
            <ProtectedRoleRoute allowedRoles={["admin"]}>
              <AdminMessages />
            </ProtectedRoleRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoleRoute allowedRoles={["admin"]}>
              <AdminSettings />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/mes-visites"
          element={
            <ProtectedRoleRoute allowedRoles={["client"]}>
              <MyVisits />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <ProtectedRoleRoute allowedRoles={["client"]}>
              <NotificationsPage />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoleRoute allowedRoles={["client"]}>
              <Profile />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/change-password"
          element={
            <ProtectedRoleRoute allowedRoles={["client"]}>
              <ChangePassword />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/changer-mot-de-passe"
          element={
            <ProtectedRoleRoute allowedRoles={["client"]}>
              <ChangePassword />
            </ProtectedRoleRoute>
          }
        />

        <Route
          path="/contact"
          element={<Contact />}
        />

        <Route
          path="/a-propos"
          element={<APropos />}
        />

      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
