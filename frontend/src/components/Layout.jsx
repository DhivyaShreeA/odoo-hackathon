import { Navigate, Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";

function isAuthed() {
  return Boolean(localStorage.getItem("stocksense_token"));
}

export function ProtectedRoute() {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-full overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}
