import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import AuthLayout from "../components/AuthLayout.jsx";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState("request"); // request -> reset
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestOtp(e) {
    e.preventDefault();
    setError("");
    setPreviewUrl("");
    setLoading(true);
    try {
      const data = await api("/auth/forgot-password", { method: "POST", body: { email }, auth: false });
      // The OTP is actually emailed by the server (see backend/mailer.js).
      // previewUrl only appears when no real SMTP is configured yet — it
      // links to the live test inbox so you can open the real email received.
      setInfo(data.message);
      setPreviewUrl(data.previewUrl || "");
      setStep("reset");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: { email, otp, newPassword }, auth: false });
      navigate("/login");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-xl font-semibold text-ink">Reset password</h1>
      <p className="text-sm text-muted mt-1 mb-6">
        {step === "request" ? "We'll send a one-time code to your email" : "Enter the code and a new password"}
      </p>

      {error && (
        <div className="mb-4 text-sm text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {info && (
        <div className="mb-4 text-sm text-good bg-good/10 border border-good/20 rounded-md px-3 py-2">
          {info}
          {previewUrl && (
            <>
              {" "}
              <a href={previewUrl} target="_blank" rel="noreferrer" className="underline font-medium">
                Open the email →
              </a>
            </>
          )}
        </div>
      )}

      {step === "request" ? (
        <form onSubmit={requestOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
              placeholder="you@company.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-dark text-white text-sm font-medium py-2.5 rounded-md transition-colors disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1">6-digit code</label>
            <input
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-md border border-border px-3 py-2 text-sm tracking-widest focus:border-primary"
              placeholder="123456"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">New password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-primary"
              placeholder="At least 6 characters"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-dark text-white text-sm font-medium py-2.5 rounded-md transition-colors disabled:opacity-60"
          >
            {loading ? "Resetting…" : "Reset password"}
          </button>
        </form>
      )}

      <p className="mt-4 text-sm text-center">
        <Link to="/login" className="text-primary hover:underline">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
}
