"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Copy, Check, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

interface Code {
  id: number
  code: string
  description: string
  created_at: string
  used: boolean
  used_at: string | null
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

export default function TwoFACodesPage() {
  const router = useRouter()
  const [codes, setCodes] = useState<Code[]>([])
  const [verifications, setVerifications] = useState<Verification[]>([])
  const [loading, setLoading] = useState(true)
  const [verificationString, setVerificationString] = useState("")
  const [payoutId, setPayoutId] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [description, setDescription] = useState("")
  const [copied, setCopied] = useState<number | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch 2FA codes
      const codesResponse = await fetch("/api/admin/2fa-codes")
      const codesData = await codesResponse.json()

      // Fetch verification requests
      const verificationsResponse = await fetch("/api/admin/verifications")
      const verificationsData = await verificationsResponse.json()

      setCodes(codesData.codes || [])
      setVerifications(verificationsData.verifications || [])
    } catch (error) {
      console.error("Error fetching data:", error)
      setMessage({ text: "Failed to fetch data", type: "error" })
    } finally {
      setLoading(false)
    }
  }

  const generateCode = async () => {
    if (!verificationString) {
      setMessage({ text: "Verification string is required", type: "error" })
      return
    }

    setGenerating(true)
    try {
      const response = await fetch("/api/nowpayments/generate-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verification_string: verificationString,
          payout_id: payoutId || undefined,
          description: description || undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ text: "Code generated successfully", type: "success" })
        setVerificationString("")
        setDescription("")
        fetchData()
      } else {
        setMessage({ text: data.error || "Failed to generate code", type: "error" })
      }
    } catch (error) {
      console.error("Error generating code:", error)
      setMessage({ text: "Failed to generate code", type: "error" })
    } finally {
      setGenerating(false)
    }
  }

  const verifyPayout = async () => {
    if (!payoutId || !verificationCode) {
      setMessage({ text: "Payout ID and verification code are required", type: "error" })
      return
    }

    setVerifying(true)
    try {
      const response = await fetch("/api/nowpayments/verify-payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payout_id: payoutId,
          verification_code: verificationCode,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ text: "Payout verified successfully", type: "success" })
        setPayoutId("")
        setVerificationCode("")
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

  const copyToClipboard = (code: string, id: number) => {
    navigator.clipboard.writeText(code)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
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
          <h1 className="text-2xl font-bold">2FA Codes & Verification</h1>
          <button onClick={fetchData} className="ml-auto p-2 rounded-full hover:bg-accent">
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

        {/* Generate Code Form */}
        <div className="bg-card p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-semibold mb-4">Generate 2FA Code</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="verificationString" className="block text-sm font-medium mb-1">
                Verification String
              </label>
              <input
                id="verificationString"
                type="text"
                value={verificationString}
                onChange={(e) => setVerificationString(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="Enter the verification string from NOWPayments"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                Description (Optional)
              </label>
              <input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="Add a description for this code"
              />
            </div>
            <div>
              <label htmlFor="payoutId" className="block text-sm font-medium mb-1">
                Payout ID (Optional)
              </label>
              <input
                id="payoutId"
                type="text"
                value={payoutId}
                onChange={(e) => setPayoutId(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="Link to a specific payout ID"
              />
            </div>
            <button
              onClick={generateCode}
              disabled={generating || !verificationString}
              className="w-full bg-primary text-primary-foreground py-2 rounded-md disabled:opacity-50"
            >
              {generating ? "Generating..." : "Generate Code"}
            </button>
          </div>
        </div>

        {/* Verify Payout Form */}
        <div className="bg-card p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-semibold mb-4">Verify Payout</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="payoutIdVerify" className="block text-sm font-medium mb-1">
                Payout ID
              </label>
              <input
                id="payoutIdVerify"
                type="text"
                value={payoutId}
                onChange={(e) => setPayoutId(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="Enter the payout ID"
              />
            </div>
            <div>
              <label htmlFor="verificationCode" className="block text-sm font-medium mb-1">
                Verification Code
              </label>
              <input
                id="verificationCode"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="w-full p-2 border rounded-md"
                placeholder="Enter the verification code"
              />
            </div>
            <button
              onClick={verifyPayout}
              disabled={verifying || !payoutId || !verificationCode}
              className="w-full bg-primary text-primary-foreground py-2 rounded-md disabled:opacity-50"
            >
              {verifying ? "Verifying..." : "Verify Payout"}
            </button>
          </div>
        </div>

        {/* Pending Verifications */}
        <div className="bg-card p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-semibold mb-4">Pending Verifications</h2>
          {loading ? (
            <p>Loading...</p>
          ) : verifications.length === 0 ? (
            <p>No pending verifications</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Payout ID</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Created</th>
                    <th className="text-left py-2">Code</th>
                    <th className="text-left py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {verifications.map((verification) => (
                    <tr key={verification.id} className="border-b">
                      <td className="py-2">{verification.payout_id}</td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            verification.status === "verified"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {verification.status}
                        </span>
                      </td>
                      <td className="py-2">{formatDate(verification.created_at)}</td>
                      <td className="py-2">{verification.verification_code || "Not generated"}</td>
                      <td className="py-2">
                        <button
                          onClick={() => {
                            setPayoutId(verification.payout_id)
                            if (verification.verification_code) {
                              setVerificationCode(verification.verification_code)
                            }
                          }}
                          className="text-primary hover:underline"
                        >
                          Use
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Generated Codes */}
        <div className="bg-card p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Generated Codes</h2>
          {loading ? (
            <p>Loading...</p>
          ) : codes.length === 0 ? (
            <p>No codes generated yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Code</th>
                    <th className="text-left py-2">Description</th>
                    <th className="text-left py-2">Created</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((code) => (
                    <tr key={code.id} className="border-b">
                      <td className="py-2 font-mono">{code.code}</td>
                      <td className="py-2">{code.description}</td>
                      <td className="py-2">{formatDate(code.created_at)}</td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            code.used ? "bg-gray-100 text-gray-800" : "bg-green-100 text-green-800"
                          }`}
                        >
                          {code.used ? "Used" : "Available"}
                        </span>
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => copyToClipboard(code.code, code.id)}
                          className="text-primary hover:underline flex items-center"
                        >
                          {copied === code.id ? (
                            <>
                              <Check className="w-4 h-4 mr-1" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 mr-1" /> Copy
                            </>
                          )}
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

