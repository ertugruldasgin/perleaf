import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router";
import { getMe, type User } from "./api";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { ProjectPage } from "./pages/ProjectPage";

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) return null;
  if (user === null) return <Login />;

  return (
    <Routes>
      <Route path="/" element={<Home user={user} />} />
      <Route path="/p/:id" element={<ProjectPage user={user} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
