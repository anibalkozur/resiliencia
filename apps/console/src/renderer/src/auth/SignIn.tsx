import { useState } from 'react';

type Props = {
  onSignIn: () => Promise<void>;
};

export function SignInScreen({ onSignIn }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await onSignIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-brand">
        <h1>ResiliencIA Console</h1>
        <p>
          Consola de administración de ResiliencIA: usuarios, suscripciones, simulador del ciclo
          premium y asistencia por IA.
        </p>
      </div>
      <div className="login-form">
        <h2>Ingresá como administrador</h2>
        <p className="sub">Usá la misma cuenta de Google que figura en la allowlist de admins.</p>
        <button className="btn primary" onClick={handleClick} disabled={busy}>
          {busy ? 'Conectando…' : 'Continuar con Google'}
        </button>
        {error && <div className="error">{error}</div>}
        <div className="shield-note">
          Tu sesión se guarda cifrada en el almacén seguro de Windows (keychain del SO), nunca en
          texto plano. Todas las acciones quedan registradas con auditoría en el servidor.
        </div>
      </div>
    </div>
  );
}
