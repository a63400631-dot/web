import { createRoot } from "react-dom/client";
import { Dashboard, Login } from "./dashboard";

const root = document.getElementById("root")!;
createRoot(root).render(root.dataset.authenticated === "yes" ? <Dashboard demo={false} /> : <Login />);
