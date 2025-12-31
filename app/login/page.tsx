"use client";

import { useMemo, useState } from "react";
import { useRedirectIfAuthed } from "@/lib/useRouteGuard";

type ApiError = { ok: false; error: { code: string; message: string; details?: any } };

type LoginOkData = {
    user: {
        employeeId: number;
        companyId: number;
        role: "EMPLOYEE" | "ADMIN" | "OWNER";
        name: string | null;
        companyName: string;
    };
};

type LoginNeedsPickData = {
    needsCompanyPick: true;
    challengeToken: string;
    companies: { companyId: number; companyName: string }[];
};

type ApiOk<T> = { ok: true; data: T };
type LoginResponse = ApiOk<LoginOkData | LoginNeedsPickData> | ApiError;



export default function LoginPage() {
    const { loading: guardLoading } = useRedirectIfAuthed({ redirectTo: "/admin" });

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // multi-company flow
    const [needsPick, setNeedsPick] = useState(false);
    const [challengeToken, setChallengeToken] = useState<string | null>(null);
    const [companies, setCompanies] = useState<{ companyId: number; companyName: string }[]>([]);
    const [companyId, setCompanyId] = useState<number | "">("");

    const canSubmit = useMemo(() => {
        if (loading) return false;
        if (!needsPick) return email.trim().length > 0 && password.length > 0;
        return challengeToken && companyId !== "";
    }, [loading, needsPick, email, password, challengeToken, companyId]);

    async function postJson<T>(url: string, body: any): Promise<T> {
        const res = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return data as T;
    }

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setErrorMsg(null);
        setLoading(true);

        try {
            const data = await postJson<LoginResponse>("/api/auth/login", {

                email,
                password,
            });

            if (data.ok === false) {
                setErrorMsg(data.error?.message ?? "Login failed");
                return;
            }

            const payload = data.data;

            // needs company pick
            if ("needsCompanyPick" in payload && payload.needsCompanyPick) {
                setNeedsPick(true);
                setChallengeToken(payload.challengeToken);
                setCompanies(payload.companies ?? []);
                setCompanyId("");
                return;
            }

            // success
            if ("user" in payload) {
                window.location.href =
                    payload.user.role === "EMPLOYEE" ? "/employee" : "/admin";
                return;
            }


            // defensive fallback (should never happen)
            setErrorMsg("Unexpected login response.");
            return;


        } catch (err: any) {
            setErrorMsg(err?.message ?? "Unexpected error");
        } finally {
            setLoading(false);
        }
    }

    async function handleChooseCompany(e: React.FormEvent) {
        e.preventDefault();
        if (!challengeToken || companyId === "") return;

        setErrorMsg(null);
        setLoading(true);

        try {
            const data = await postJson<ApiOk<LoginOkData> | ApiError>("/api/auth/login/choose-company", {

                challengeToken,
                companyId,
            });

            if (data.ok === false) {
                setErrorMsg(data.error?.message ?? "Signup failed");
                return;
            }

            // success: cookie should be set server-side
            window.location.href =
                data.data.user.role === "EMPLOYEE" ? "/employee" : "/admin";
            return;


        } catch (err: any) {
            setErrorMsg(err?.message ?? "Unexpected error");
        } finally {
            setLoading(false);
        }
    }
    if (guardLoading) return null;
    return (


        <main style={{ maxWidth: 520, margin: "0 auto", padding: "48px 20px" }}>
            <h1>Login</h1>

            {!needsPick ? (
                <form onSubmit={handleLogin} style={{ display: "grid", gap: 12, marginTop: 20 }}>
                    <label style={{ display: "grid", gap: 6 }}>
                        <span>Email</span>
                        <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            placeholder="you@company.com"
                            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
                        />
                    </label>

                    <label style={{ display: "grid", gap: 6 }}>
                        <span>Password</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
                        />
                    </label>

                    {errorMsg ? <p style={{ color: "crimson" }}>{errorMsg}</p> : null}

                    <button
                        disabled={!canSubmit}
                        style={{ padding: 10, borderRadius: 10, border: "1px solid #333" }}
                    >
                        {loading ? "Logging in..." : "Login"}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleChooseCompany} style={{ display: "grid", gap: 12, marginTop: 20 }}>
                    <p style={{ margin: 0 }}>
                        This email exists in multiple companies. Choose which company to log into.
                    </p>

                    <label style={{ display: "grid", gap: 6 }}>
                        <span>Company</span>
                        <select
                            value={companyId}
                            onChange={(e) => setCompanyId(e.target.value ? Number(e.target.value) : "")}
                            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
                        >
                            <option value="">Select...</option>
                            {companies.map((c) => (
                                <option key={c.companyId} value={c.companyId}>
                                    {c.companyName}
                                </option>
                            ))}
                        </select>
                    </label>

                    {errorMsg ? <p style={{ color: "crimson" }}>{errorMsg}</p> : null}

                    <button
                        disabled={!canSubmit}
                        style={{ padding: 10, borderRadius: 10, border: "1px solid #333" }}
                    >
                        {loading ? "Logging in..." : "Continue"}
                    </button>
                </form>
            )}
        </main>
    );
}
