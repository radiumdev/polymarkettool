"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) setError("Invalid email or password");
    else router.push("/");
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d4aa] to-[#7c5cfc] flex items-center justify-center text-lg font-bold text-white">⚡</div>
            <span className="text-xl font-bold text-white">PolyCopy</span>
          </div>
          <p className="text-sm text-zinc-500">Copy-trade Polymarket whales</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#12131a] border border-[#1e2030] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d4aa]/50" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#12131a] border border-[#1e2030] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d4aa]/50" placeholder="••••••••" required />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-lg font-semibold text-sm bg-gradient-to-r from-[#00d4aa] to-[#7c5cfc] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-zinc-500">
          No account? <a href="/signup" className="text-[#00d4aa] hover:underline">Sign up</a>
        </p>
      </div>
    </div>
  );
}
