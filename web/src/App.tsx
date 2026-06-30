import { useState } from "react";

export default function App() {
  const [token, setToken] = useState<string | null>(null);

  if (!token) {
    return <LoginScreen onLogin={setToken} />;
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", padding: 32 }}>
      <h1 style={{ color: "#FF6B00" }}>Dropi Product Assistant</h1>
      <p>Bienvenido. El workspace está cargando.</p>
      <button onClick={() => setToken(null)} style={{ marginTop: 16 }}>
        Cerrar sesión
      </button>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error de autenticación"); return; }
      onLogin(data.token);
    } catch {
      setError("Error de red");
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, width: 320 }}>
        <h2 style={{ color: "#FF6B00", margin: 0 }}>Dropi</h2>
        {error && <p style={{ color: "#EF4444", margin: 0 }}>{error}</p>}
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E8E8E3" }} />
        <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E8E8E3" }} />
        <button type="submit" style={{ background: "#FF6B00", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", cursor: "pointer" }}>Entrar</button>
      </form>
    </div>
  );
}
