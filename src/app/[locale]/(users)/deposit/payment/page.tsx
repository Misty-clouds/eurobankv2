"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "@/i18n/routing"
import { ArrowLeft, Check, Copy, QrCode, RefreshCw, Loader } from "lucide-react"
import BottomNav from "@/lib/components/BottomNav"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import axios from "axios"
import { createClient } from "@/utils/supabase/client"
import QRCode from "qrcode"

export default function CustomPaymentPage() {
  const router = useRouter()
  const t = useTranslations("PaymentPage")
  const pathname = usePathname()

  const [paymentDetails, setPaymentDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [copied, setCopied] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState("creating")
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [isNavigating, setIsNavigating] = useState(false)

  // Use refs to track all timers and intervals
  const statusCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null)
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null)

  const supabase = createClient()
  const paymentId = sessionStorage.getItem("paymentId")

  // Cleanup function to clear all timers and intervals
  const cleanupAllTimers = useCallback(() => {
    // Clear status check interval
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current)
      statusCheckIntervalRef.current = null
    }

    // Clear countdown timer
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current)
      countdownTimerRef.current = null
    }

    // Clear redirect timer
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current)
      redirectTimerRef.current = null
    }

    // Clear copy timer
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = null
    }
  }, [])

  // Custom navigation function that cleans up before navigating
  const safeNavigate = useCallback(
    (path: string) => {
      setIsNavigating(true)
      cleanupAllTimers()
      router.push(path)
    },
    [router, cleanupAllTimers],
  )

  // Fetch payment details from Supabase
  useEffect(() => {
    const fetchPaymentDetails = async () => {
      if (!paymentId) {
        setError("Payment ID not found")
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase.from("deposits").select("*").eq("payment_id", paymentId).single()

        if (error) {
          console.error("Database error:", error)
          setError("Payment not found")
          setLoading(false)
          return
        }

        if (data) {
          setPaymentDetails(data)
          setPaymentStatus(data.status)

          // Generate QR code for wallet address
          if (data.wallet_address) {
            generateQRCode(data.wallet_address)
          }

          // Set expiration timer if available
          if (data.expires_at) {
            const expiresAt = new Date(data.expires_at).getTime()
            const now = new Date().getTime()
            setTimeLeft(Math.max(0, Math.floor((expiresAt - now) / 1000)))
          }

          setLoading(false)
        }
      } catch (err) {
        console.error("Error fetching payment details:", err)
        setError("Failed to load payment details")
        setLoading(false)
      }
    }

    fetchPaymentDetails()

    // Cleanup on unmount
    return () => {
      cleanupAllTimers()
    }
  }, [paymentId, cleanupAllTimers])

  // Generate QR code from wallet address
  const generateQRCode = async (walletAddress: string) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(walletAddress, {
        width: 256,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      })
      setQrCodeUrl(qrDataUrl)
    } catch (err) {
      console.error("Error generating QR code:", err)
    }
  }

  // Set up automatic status checking
  useEffect(() => {
    // Don't set up new intervals if we're navigating away
    if (isNavigating) return

    // Start automatic status checking if payment is pending or confirming
    if ((paymentStatus === "creating" || paymentStatus === "confirming") && paymentId) {
      // Initial check
      checkPaymentStatus()

      // Set up interval for checking - more frequent for confirming status
      const checkInterval = paymentStatus === "confirming" ? 15000 : 60000 // 15 seconds for confirming, 60 seconds for creating

      // Clear any existing interval before setting a new one
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current)
      }

      statusCheckIntervalRef.current = setInterval(() => {
        checkPaymentStatus()
      }, checkInterval)
    }

    // Clean up interval on component unmount or status change
    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current)
        statusCheckIntervalRef.current = null
      }
    }
  }, [paymentStatus, paymentId, isNavigating])

  // Countdown timer
  useEffect(() => {
    // Don't set up new timers if we're navigating away
    if (isNavigating) return

    if (timeLeft > 0) {
      countdownTimerRef.current = setTimeout(() => {
        setTimeLeft(timeLeft - 1)
      }, 1000)

      return () => {
        if (countdownTimerRef.current) {
          clearTimeout(countdownTimerRef.current)
          countdownTimerRef.current = null
        }
      }
    } else if (timeLeft === 0 && paymentDetails) {
      // Payment time expired
      setPaymentStatus("expired")

      // Stop status checking if payment expired
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current)
        statusCheckIntervalRef.current = null
      }
    }
  }, [timeLeft, paymentDetails, isNavigating])

  // Check payment status function
  const checkPaymentStatus = async () => {
    // Don't check status if we're already checking or navigating away
    if (checkingStatus || !paymentId || isNavigating) return

    try {
      setCheckingStatus(true)

      const response = await axios.get(`/api/deposit/check-status?paymentId=${paymentId}`)

      // If we're navigating away, don't update state
      if (isNavigating) return

      if (response.data.success) {
        const newStatus = response.data.status
        setPaymentStatus(newStatus)

        // If status changes to confirming, update the check interval to be more frequent
        if (newStatus === "confirming" && statusCheckIntervalRef.current) {
          clearInterval(statusCheckIntervalRef.current)
          statusCheckIntervalRef.current = setInterval(() => {
            checkPaymentStatus()
          }, 60000) // Check every 15 seconds during confirmation
        }

        // If payment is confirmed or completed, stop checking and redirect
        if (newStatus === "confirmed" || newStatus === "completed") {
          if (statusCheckIntervalRef.current) {
            clearInterval(statusCheckIntervalRef.current)
            statusCheckIntervalRef.current = null
          }

          // Short delay before redirect
          redirectTimerRef.current = setTimeout(() => {
            safeNavigate(`/deposit/success`)
          }, 2000)
        }
      }
    } catch (err) {
      console.error("Error checking payment status:", err)
    } finally {
      if (!isNavigating) {
        setCheckingStatus(false)
      }
    }
  }

  // Copy wallet address to clipboard
  const copyToClipboard = (text: string) => {
    if (!text || isNavigating) return

    navigator.clipboard.writeText(text)
    setCopied(true)

    // Clear any existing copy timer
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current)
    }

    copyTimerRef.current = setTimeout(() => {
      if (!isNavigating) {
        setCopied(false)
      }
    }, 2000)
  }

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Add event listener for beforeunload to clean up timers
  useEffect(() => {
    const handleBeforeUnload = () => {
      cleanupAllTimers()
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [cleanupAllTimers])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-secondary p-4 flex justify-between items-center mb-8 rounded-2xl">
            <div className="flex items-center space-x-4">
              <button onClick={() => safeNavigate("/dashboard")} className="text-muted-foreground hover:text-primary">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-2xl text-primary font-bold">{t("payment")}</h1>
            </div>
          </div>

          <div className="bg-red-900/20 backdrop-blur-md p-6 mb-8 rounded-2xl border border-red-700/50 flex flex-col items-center">
            <h2 className="text-2xl font-bold text-red-500 mb-4">{t("error")}</h2>
            <p className="text-center">{error}</p>
            <button
              onClick={() => safeNavigate("/deposit")}
              className="mt-6 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-xl"
            >
              {t("backToDeposit")}
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  // Confirming state - special UI for transaction confirmation
  if (paymentStatus === "confirming") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-secondary p-4 flex justify-between items-center mb-8 rounded-2xl">
            <div className="flex items-center space-x-4">
              <button onClick={() => safeNavigate("/dashboard")} className="text-muted-foreground hover:text-primary">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-2xl text-primary font-bold">{t("payment")}</h1>
            </div>
          </div>

          <div className="bg-yellow-900/20 backdrop-blur-md p-6 mb-8 rounded-2xl border border-yellow-700/50 flex flex-col items-center">
            <div className="w-24 h-24 bg-yellow-600 rounded-full flex items-center justify-center mb-4">
              <Loader className="w-12 h-12 text-white animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-yellow-500 mb-2">{t("confirmingTransaction")}</h2>
            <p className="text-center text-muted-foreground mb-4">{t("confirmingDescription")}</p>

            {/* Progress bar */}
            <div className="w-full max-w-md bg-background/30 h-3 rounded-full overflow-hidden mt-4">
              <div className="h-full bg-yellow-500 rounded-full animate-pulse" style={{ width: "60%" }}></div>
            </div>

            <p className="text-sm text-muted-foreground mt-4">{t("doNotCloseConfirming")}</p>
          </div>

          {/* Transaction details */}
          <div className="bg-accent-800/50 backdrop-blur-md rounded-2xl p-6 mb-8 border border-blue-700/50 space-y-4">
            <h3 className="text-lg font-medium text-primary">{t("transactionDetails")}</h3>

            <div className="bg-background/30 p-4 rounded-xl">
              <label className="block text-sm text-muted-foreground mb-2">{t("amount")}</label>
              <p className="font-medium text-primary">{paymentDetails?.amount} USDT</p>
            </div>

            <div className="bg-background/30 p-4 rounded-xl">
              <label className="block text-sm text-muted-foreground mb-2">{t("status")}</label>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2 animate-pulse"></div>
                <p className="font-medium text-yellow-500">{t("confirming")}</p>
              </div>
            </div>

            <div className="bg-background/30 p-4 rounded-xl">
              <label className="block text-sm text-muted-foreground mb-2">{t("estimatedTime")}</label>
              <p className="font-medium text-primary">{t("fewMinutes")}</p>
            </div>

            {/* Status checking indicator */}
            <div className="flex items-center justify-center mt-6 text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              <span>{t("checkingConfirmation")}</span>
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 pb-24">
        {/* Header */}
        <div className="bg-secondary p-4 flex justify-between items-center mb-8 rounded-2xl">
          <div className="flex items-center space-x-4">
            <button onClick={() => safeNavigate("/deposit")} className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl text-primary font-bold">{t("payment")}</h1>
          </div>
        </div>

        {/* Payment Status */}
        <div
          className={`backdrop-blur-md p-6 mb-8 rounded-2xl border flex flex-col items-center
          ${
            paymentStatus === "expired"
              ? "bg-red-900/20 border-red-700/50"
              : paymentStatus === "creating"
          ? "bg-blue-900/20 border-blue-700/50"
          : "bg-green-900/20 border-green-700/50"
          }`}
        >
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center mb-4
            ${
              paymentStatus === "expired" ? "bg-red-600" : paymentStatus === "creating" ? "bg-blue-600" : "bg-green-600"
            }`}
          >
            {paymentStatus === "expired" ? (
              <RefreshCw className="w-12 h-12 text-white" />
            ) : paymentStatus === "creating" ? (
              <QrCode className="w-12 h-12 text-white" />
            ) : (
              <Check className="w-12 h-12 text-white" />
            )}
          </div>

          <h2 className="text-2xl font-bold mb-2">
            {paymentStatus === "expired"
              ? t("paymentExpired")
              : paymentStatus === "creating"
          ? t("awaitingPayment")
          : t("paymentReceived")}
          </h2>

          {paymentStatus === "creating" && timeLeft > 0 && (
            <p className="text-yellow-500 font-bold">
              {t("timeRemaining")}: {formatTime(timeLeft)}
            </p>
          )}

          {paymentStatus === "expired" && (
            <button
              onClick={() => safeNavigate("/deposit")}
              className="mt-4 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded-xl"
            >
              {t("tryAgain")}
            </button>
          )}

          {(paymentStatus === "completed" || paymentStatus === "confirmed") && (
            <button
              onClick={() => safeNavigate(`/deposit/success`)}
              className="mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl"
            >
              {t("continue")}
            </button>
          )}
        </div>

        {/* Payment Details */}
        {paymentStatus === "creating" && paymentDetails && (
          <div className="bg-accent-800/50 backdrop-blur-md rounded-2xl p-6 mb-8 border border-blue-700/50 space-y-6">
            {/* Amount */}
            <div className="text-center">
              <h3 className="text-lg text-muted-foreground mb-2">{t("sendExactly")}</h3>
              <p className="text-3xl font-bold text-primary">{paymentDetails.amount} USDT</p>
              <p className="text-sm text-muted-foreground mt-1">≈ ${paymentDetails.amount} USD</p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl || "/placeholder.svg"}
                  alt="Payment QR Code"
                  className="w-64 h-64 bg-white p-2 rounded-xl"
                />
              ) : (
                <div className="w-64 h-64 bg-accent flex items-center justify-center rounded-xl">
                  <QrCode className="w-16 h-16 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Wallet Address */}
            <div className="bg-background/30 p-4 rounded-xl">
              <label className="block text-sm text-muted-foreground mb-2">{t("walletAddress")}</label>
              <div className="flex items-center justify-between bg-background/50 p-3 rounded-lg border border-blue-700/30">
                <p className="text-sm font-mono text-primary overflow-x-auto whitespace-nowrap mr-2">
                  {paymentDetails.wallet_address}
                </p>
                <button
                  onClick={() => copyToClipboard(paymentDetails.wallet_address)}
                  className="flex-shrink-0 text-primary hover:text-primary/80"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Network */}
            <div className="bg-background/30 p-4 rounded-xl">
              <label className="block text-sm text-muted-foreground mb-2">{t("network")}</label>
              <p className="font-medium text-primary">Binance Smart Chain (BEP20)</p>
            </div>

            {/* Status Indicator */}
            <div className="bg-background/30 p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("checkingStatus")}</span>
                <div className="flex items-center">
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${checkingStatus ? "animate-spin text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="text-xs text-muted-foreground">
                    {checkingStatus ? t("checkingStatus") : t("autoRefresh")}
                  </span>
                </div>
              </div>
              <div className="mt-2 w-full bg-background/50 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse"></div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-900/20 p-4 rounded-xl border border-blue-700/30">
              <h4 className="font-medium text-primary mb-2">{t("instructions")}</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>{t("sendExactAmount")}</li>
                <li>{t("confirmationTime")}</li>
                <li>{t("autoCheckStatus")}</li>
                <li>{t("doNotClose")}</li>
              </ul>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}

