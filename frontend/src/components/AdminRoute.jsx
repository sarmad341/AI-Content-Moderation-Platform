// frontend/src/components/AdminRoute.jsx
import { useUser } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

function AdminRoute({ children }) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <p>Loading...</p>;
  }

  const role = user?.publicMetadata?.role || "user";

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default AdminRoute;
