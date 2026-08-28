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
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 px-4 transition-colors duration-200">
      <form 
        onSubmit={handleLogin} 
        className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-xl space-y-4 w-full max-w-md border border-gray-100 dark:border-gray-700 transition-colors duration-200"
      >
        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-6">Dienstplan Login</h2>
        
        {error && (
          <div className="text-red-500 text-sm text-center bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 p-2 rounded-lg">
            {error}
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-Mail-Adresse</label>
          <input 
            type="email" 
            placeholder="name@example.com" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Passwort</label>
          <input 
            type="password" 
            placeholder="••••••••" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none"
          />
        </div>
        
        <button 
          type="submit" 
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-sm cursor-pointer mt-2"
        >
          Einloggen
        </button>
      </form>
    </div>
  );
}
