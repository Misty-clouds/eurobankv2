"use client"

import { useEffect, useState } from "react"
import { useRouter } from "@/i18n/routing"
import { CheckCircle, ArrowLeft } from "lucide-react"
import BottomNav from "@/lib/components/BottomNav"
import { useTranslations } from "next-intl"

export default function DepositSuccessPage() {
  const router = useRouter()
  const t = useTranslations("DepositPage")
  const [paymentId, setPaymentId] = useState<string | null>(null)
  const [status, setStatus] = useState("processing")
  const [isLoading, setIsLoading] = useState(true)
  const [paymentDetails, setPaymentDetails] = useState<any>(null)

  useEffect(() => {
    // Get payment ID from URL or session storage
    const urlParams = new URLSearchParams(window.location.search)
    const paymentIdFromUrl = urlParams.get("payment_id")
    const paymentIdFromSession = sessionStorage.getItem("paymentId")
    const locale = sessionStorage.getItem("paymentLocale")

    // Try to get stored payment details
    try {
      const storedDetails = sessionStorage.getItem("paymentDetails")
      if (storedDetails) {
        setPaymentDetails(JSON.parse(storedDetails))
      }
    } catch (e) {
      console.error("Error parsing stored payment details:", e)
    }

    const id = paymentIdFromUrl || paymentIdFromSession
    setPaymentId(id)

    if (id) {
      checkPaymentStatus(id)
    } else {
      setIsLoading(false)
    }
  }, [])

  const checkPaymentStatus = async (id: string) => {
    try {
      const response = await fetch("/api/deposit/check-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: id }),
      })

      const data = await response.json()

      if (response.ok) {
        setStatus(data.status)
        // Store locale from response if available
        if (data.locale) {
          sessionStorage.setItem("paymentLocale", data.locale)
        }
        // Update payment details if available
        if (data.payment) {
          setPaymentDetails(data.payment)
        }
      }
    } catch (error) {
      console.error("Error checking payment status:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const PaymentDetails = ({ paymentId, paymentDetails }: { paymentId: string; paymentDetails: any }) => {
    if (!paymentDetails) {
      return (
        <p className="text-sm text-muted-foreground">
          {t("paymentId")}: {paymentId}
        </p>
      )
    }

    return (
      <div>
        <p className="text-sm text-muted-foreground">
          {t("paymentId")}: {paymentId}
        </p>
        {Object.entries(paymentDetails).map(([key, value]) => (
          <p key={key} className="text-sm text-muted-foreground">
            {key}: {String(value)}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-secondary p-4 flex justify-between items-center mb-8 rounded-2xl">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.push("/dashboard")} className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl text-primary font-bold">{t("depositStatus")}</h1>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-blue-900/50 backdrop-blur-md p-8 rounded-2xl border border-blue-700/50 flex flex-col items-center mb-8">
          {isLoading ? (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <h2 className="text-2xl font-bold text-primary mb-2">{t("checkingStatus")}</h2>
            </div>
          ) : (
            <>
              <div className="w-24 h-24 bg-green-600/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-primary mb-2">
                {status === "completed"
                  ? t("depositComplete")
                  : status === "processing"
                    ? t("depositProcessing")
                    : t("depositInitiated")}
              </h2>
              <p className="text-muted-foreground text-center mb-4">
                {status === "completed"
                  ? t("fundsAddedToAccount")
                  : status === "processing"
                    ? t("waitingForConfirmation")
                    : t("waitingForPayment")}
              </p>

              {/* Payment Details Component */}
              {paymentId && <PaymentDetails paymentId={paymentId} paymentDetails={paymentDetails} />}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-4">
          <button
            onClick={() => {
              const locale = sessionStorage.getItem("paymentLocale") || ""
              router.push("/dashboard", { locale })
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all"
          >
            {t("backToDashboard")}
          </button>

          {status !== "completed" && (
            <button
              onClick={() => paymentId && checkPaymentStatus(paymentId)}
              className="w-full bg-secondary hover:bg-secondary/80 text-primary font-bold py-4 rounded-2xl transition-all"
            >
              {t("refreshStatus")}
            </button>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

