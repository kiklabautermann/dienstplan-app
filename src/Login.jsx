import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); // Fehler zurücksetzen
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Wenn erfolgreich, ändert sich der Auth-State automatisch (wird in App.jsx behandelt)
    } catch (err) {
      setError("Login fehlgeschlagen. Bitte überprüfe E-Mail und Passwort.");
      console.error(err);
    }
  };

  return (
    <div style={{
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      backgroundColor: '#f3f4f6'
    }}>
      <form onSubmit={handleLogin} style={{
        background: 'white', 
        padding: '2rem', 
        borderRadius: '8px', 
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 1rem 0' }}>Dienstplan Login</h2>
        
        {error && <div style={{ color: 'red', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}
        
        <input 
          type="email" 
          placeholder="E-Mail" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        
        <input 
          type="password" 
          placeholder="Passwort" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        
        <button type="submit" style={{
          padding: '0.75rem', 
          backgroundColor: '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: 'bold'
        }}>
          Einloggen
        </button>
      </form>
    </div>
  );
}
