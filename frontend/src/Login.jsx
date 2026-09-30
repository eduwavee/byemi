import React, { useState } from "react";
import { api, auth } from "./api";

// mode: "login" (ya hay clave) | "setup" (primera vez: crear la clave)
export default function Login({ mode, onDone }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isSetup = mode === "setup";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (isSetup && password !== repeat) {
      setError("Las claves no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const { token } = isSetup ? await api.setupPassword(password) : await api.login(password);
      auth.setToken(token);
      onDone();
    } catch (err) {
      setError(err.message || "No se pudo entrar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page loginPage">
      <form className="loginCard" onSubmit={submit}>
        <div className="brandMark loginMark" aria-hidden="true">✿</div>
        <div className="eyebrow">Nails studio</div>
        <h1 className="brand">by <em>Emi</em></h1>
        <p className="sectionSub" style={{ margin: "10px 0 18px" }}>
          {isSetup
            ? "Creá una clave para que solo vos puedas ver la caja y los datos de tus clientas."
            : "Ingresá tu clave para entrar."}
        </p>

        <label className="field">
          <span className="fieldLabel">{isSetup ? "Clave nueva" : "Clave"}</span>
          <input
            className="input"
            type="password"
            autoComplete={isSetup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </label>
        {isSetup && (
          <label className="field">
            <span className="fieldLabel">Repetila</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
          </label>
        )}

        {error && <div className="warnBox" role="alert">{error}</div>}

        <button type="submit" className="primaryBtn loginBtn" disabled={busy || !password}>
          {busy ? "Un momento…" : isSetup ? "Crear clave y entrar" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
