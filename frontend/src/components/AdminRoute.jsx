import { useUser } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";
import Loading from "./Loading";

function AdminRoute({ children }) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <Loading />;
  }

  const role = user?.publicMetadata?.role || "user";

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default AdminRoute;
