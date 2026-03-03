"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Signup failed"); setLoading(false); return; }

      // Auto sign in after signup
      const result = await signIn("credentials", { email, password, redirect: false });
      setLoading(false);
      if (result?.error) setError("Signed up but login failed. Try signing in.");
      else router.push("/");
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00d4aa] to-[#7c5cfc] flex items-center justify-center text-lg font-bold text-white">⚡</div>
            <span className="text-xl font-bold text-white">PolyCopy</span>
          </div>
          <p className="text-sm text-zinc-500">Start copy-trading in 2 minutes</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#12131a] border border-[#1e2030] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d4aa]/50" placeholder="Your name" required />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#12131a] border border-[#1e2030] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d4aa]/50" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={6} className="w-full bg-[#12131a] border border-[#1e2030] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00d4aa]/50" placeholder="••••••••" required />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-lg font-semibold text-sm bg-gradient-to-r from-[#00d4aa] to-[#7c5cfc] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
            {loading ? "Creating account..." : "Create Account — Free"}
          </button>
        </form>

        <p className="text-center mt-4 text-[11px] text-zinc-600">Free plan: 2 tracked wallets. Upgrade for more.</p>
        <p className="text-center mt-3 text-sm text-zinc-500">
          Have an account? <a href="/login" className="text-[#00d4aa] hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
