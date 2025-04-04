"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Copy, Check, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

interface TOTPResponse {
  currentCode: string
  nextCode: string
  timeRemaining: number
  generatedAt: string
  expiresAt: string
}

interface Verification {
  id: number
  payout_id: string
  status: string
  verification_string: string | null
  verification_code: string | null
  created_at: string
  batch_id: string | null
  withdrawal_count: number | null
}

export default function TOTPGeneratorPage() {
  const AuthSeccret =process.env.AUTH_SECRET  
  const router = useRouter()
  const [secret, setSecret] = useState(AuthSeccret)
  const [totp, setTotp] = useState<TOTPResponse | null>(null)
  const [verifications, setVerifications] = useState<Verification[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [selectedPayoutId, setSelectedPayoutId] = useState("")
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  const [timeLeft, setTimeLeft] = useState(30)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchTOTP, 5000) // Refresh TOTP every 5 seconds
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (totp) {
      // Set initial time left
      setTimeLeft(totp.timeRemaining)

      // Update time left every second
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            fetchTOTP() // Refresh TOTP when time expires
            return 30
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [totp])

  useEffect(() => {
    // Update progress bar
    setProgress((timeLeft / 30) * 100)
  }, [timeLeft])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch verification requests
      const verificationsResponse = await fetch("/api/admin/verifications")
      const verificationsData = await verificationsResponse.json()

      setVerifications(verificationsData.verifications || [])

      // Fetch initial TOTP
      await fetchTOTP()
    } catch (error) {
      console.error("Error fetching data:", error)
      setMessage({ text: "Failed to fetch data", type: "error" })
    } finally {
      setLoading(false)
    }
  }

  const fetchTOTP = async () => {
    try {
      const response = await fetch("/api/nowpayments/generate-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      })

      if (response.ok) {
        const data = await response.json()
        setTotp(data)
        setTimeLeft(data.timeRemaining)
      } else {
        console.error("Failed to generate TOTP")
      }
    } catch (error) {
      console.error("Error generating TOTP:", error)
    }
  }

  const verifyPayout = async (payoutId: string) => {
    if (!payoutId) {
      setMessage({ text: "Please select a payout to verify", type: "error" })
      return
    }

    setVerifying(true)
    try {
      const response = await fetch("/api/nowpayments/verify-with-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payout_id: payoutId,
          secret,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ text: `Payout ${payoutId} verified successfully with code ${data.code_used}`, type: "success" })
        setSelectedPayoutId("")
        fetchData()
      } else {
        setMessage({ text: data.error || "Failed to verify payout", type: "error" })
      }
    } catch (error) {
      console.error("Error verifying payout:", error)
      setMessage({ text: "Failed to verify payout", type: "error" })
    } finally {
      setVerifying(false)
    }
  }

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button onClick={() => router.push("/admin")} className="mr-4">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">TOTP Generator</h1>
          <button onClick={fetchTOTP} className="ml-auto p-2 rounded-full hover:bg-accent">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`p-4 mb-6 rounded-lg ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {message.text}
          </div>
        )}

        {/* TOTP Display */}
        <div className="bg-card p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-semibold mb-4">Current TOTP Code</h2>

          <div className="mb-4">
            <label htmlFor="secret" className="block text-sm font-medium mb-1">
              Secret Key
            </label>
            <div className="flex">
              <input
                id="secret"
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="flex-1 p-2 border rounded-l-md"
              />
              <button onClick={fetchTOTP} className="bg-primary text-primary-foreground px-4 rounded-r-md">
                Update
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Default: IRgFIMsPLZDSKVbb (provided by NOWPayments)</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : totp ? (
            <div className="text-center">
              <div className="text-5xl font-mono font-bold tracking-wider mb-4">{totp.currentCode}</div>

              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${progress < 30 ? "bg-red-600" : "bg-blue-600"}`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-center mt-1">Code expires in {timeLeft} seconds</p>
              </div>

              <button
                onClick={() => copyToClipboard(totp.currentCode)}
                className="inline-flex items-center px-4 py-2 bg-secondary text-secondary-foreground rounded-md"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" /> Copy Code
                  </>
                )}
              </button>

              <div className="mt-4 text-sm text-muted-foreground">
                <p>Next code: {totp.nextCode}</p>
                <p>Generated at: {formatDate(totp.generatedAt)}</p>
              </div>
            </div>
          ) : (
            <p className="text-center py-4">Failed to generate TOTP code</p>
          )}
        </div>

        {/* Verify Payout Section */}
        <div className="bg-card p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-semibold mb-4">Verify Payout with TOTP</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="payoutSelect" className="block text-sm font-medium mb-1">
                Select Payout to Verify
              </label>
              <select
                id="payoutSelect"
                value={selectedPayoutId}
                onChange={(e) => setSelectedPayoutId(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Select a payout...</option>
                {verifications
                  .filter((v) => v.status === "pending")
                  .map((verification) => (
                    <option key={verification.id} value={verification.payout_id}>
                      {verification.payout_id} ({formatDate(verification.created_at)})
                    </option>
                  ))}
              </select>
            </div>

            <button
              onClick={() => verifyPayout(selectedPayoutId)}
              disabled={verifying || !selectedPayoutId || !totp}
              className="w-full bg-primary text-primary-foreground py-2 rounded-md disabled:opacity-50"
            >
              {verifying ? "Verifying..." : "Verify Payout with Current TOTP"}
            </button>

            <p className="text-sm text-muted-foreground">
              This will use the current TOTP code to verify the selected payout with NOWPayments.
            </p>
          </div>
        </div>

        {/* Pending Verifications */}
        <div className="bg-card p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Pending Verifications</h2>
          {loading ? (
            <p>Loading...</p>
          ) : verifications.filter((v) => v.status === "pending").length === 0 ? (
            <p>No pending verifications</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Payout ID</th>
                    <th className="text-left py-2">Created</th>
                    <th className="text-left py-2">Withdrawals</th>
                    <th className="text-left py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {verifications
                    .filter((v) => v.status === "pending")
                    .map((verification) => (
                      <tr key={verification.id} className="border-b">
                        <td className="py-2">{verification.payout_id}</td>
                        <td className="py-2">{formatDate(verification.created_at)}</td>
                        <td className="py-2">{verification.withdrawal_count || "Unknown"}</td>
                        <td className="py-2">
                          <button
                            onClick={() => {
                              setSelectedPayoutId(verification.payout_id)
                              // Scroll to verify section
                              document.getElementById("payoutSelect")?.scrollIntoView({ behavior: "smooth" })
                            }}
                            className="text-primary hover:underline"
                          >
                            Verify Now
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

