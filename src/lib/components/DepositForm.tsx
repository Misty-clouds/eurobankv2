"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "@/i18n/routing"
import { useCurrentUser } from "../auth/useCurrentUser"
import { ArrowLeft, DollarSign } from "lucide-react"
import BottomNav from "@/lib/components/BottomNav"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"



export default function DepositPage() {
  const router = useRouter()
  const t = useTranslations("DepositPage")
  const [selectedAmount, setSelectedAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [currency, setCurrency] = useState("USDT")
  const user = useCurrentUser()
  const pathname = usePathname()

  const depositLevels = [
    { label: "Level 1: $10", value: 10, dailyProfit: 2 },
    { label: "Level 2: $100", value: 100, dailyProfit: 3 },
    { label: "Level 3: $200", value: 200, dailyProfit: 6 },
    { label: "Level 4: $400", value: 400, dailyProfit: 8 },
    { label: "Level 5: $500", value: 500, dailyProfit: 15 },
    { label: "Level 6: $1,000", value: 1000, dailyProfit: 30 },
    { label: "Level 7: $2,000", value: 2000, dailyProfit: 60 },
    { label: "Level 8: $5,000", value: 5000, dailyProfit: 150 },
    { label: "Level 9: $10,000", value: 10000, dailyProfit: 300 },
    { label: "Level 10: $15,000", value: 15000, dailyProfit: 450 },
  ]

  const currencies = [ "USDT"]

  // Update the initiateDeposit function to handle the NOWPayments response format
  const initiateDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!selectedAmount) {
        throw new Error(t("pleaseSelectLevel"))
      }

      if (!currency) {
        throw new Error(t("pleaseSelectCurrency"))
      }

      if (!user) {
        console.error("User not authenticated")
        return { error: "User not authenticated" }
      }

      const locale = pathname.split("/")[1] // Extract locale from path

      // Create payment via NOWPayments API
      const response = await fetch("/api/deposit/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.supabaseId,
          amount: Number(selectedAmount),
          currency: currency,
          locale: locale, // Pass locale to the API
        }),
      })

      const data = await response.json()

      if (response.ok && data.paymentUrl) {
        // Store payment ID, locale, and additional data in session for later verification
        sessionStorage.setItem("paymentId", data.paymentId)
        sessionStorage.setItem("paymentLocale", locale)

        // Store additional payment details if available
        if (data.nowPaymentsData) {
          sessionStorage.setItem("paymentDetails", JSON.stringify(data.nowPaymentsData))
        }

        // Redirect to NOWPayments checkout page
        window.location.href = data.paymentUrl
      } else {
        sessionStorage.setItem("depositErrorMessage", data.message || t("depositFailed"))
        router.push("/depositerror")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("unexpectedError")
      sessionStorage.setItem("depositErrorMessage", errorMessage)
      router.push("/depositerror")
    } finally {
      setLoading(false)
    }
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
            <h1 className="text-2xl text-primary font-bold">{t("deposit")}</h1>
          </div>
        </div>

        {/* Deposit Overview */}
        <div className="bg-blue-900/50 backdrop-blur-md p-6 mb-8 rounded-2xl border border-blue-700/50 flex flex-col items-center">
          <div className="w-24 h-24 bg-primary-600 rounded-full flex items-center justify-center mb-4">
            <DollarSign className="w-12 h-12 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-2">{t("depositFunds")}</h2>
          <p className="text-muted-foreground text-center">{t("chooseInvestment")}</p>
        </div>

        {/* Deposit Form */}
        <form onSubmit={initiateDeposit}>
          <div className="bg-accent-800/50 backdrop-blur-md rounded-2xl p-6 mb-8 border border-blue-700/50 space-y-6">
            {/* Deposit Level Selection */}
            <div>
              <label htmlFor="depositLevel" className="block text-lg font-semibold text-primary mb-4">
                {t("selectDepositLevel")}
              </label>
              <select
                id="depositLevel"
                value={selectedAmount}
                onChange={(e) => setSelectedAmount(e.target.value)}
                required
                className="w-full px-4 py-3 bg-background/30 text-primary rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary border border-blue-700/50"
              >
                <option value="" disabled>
                  {t("chooseLevel")}
                </option>
                {depositLevels.map((level, index) => (
                  <option key={index} value={level.value}>
                    {`${level.label} (${t("dailyProfit")}: $${level.dailyProfit.toFixed(2)})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Currency Selection */}
            <div>
              <label htmlFor="currency" className="block text-lg font-semibold text-primary mb-4">
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                required
                className="w-full px-4 py-3 bg-background/30 text-primary rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary border border-blue-700/50"
              >
                {currencies.map((curr, index) => (
                  <option key={index} value={curr}>
                    {curr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl mb-9 flex items-center justify-center space-x-3 transition-all ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <DollarSign className="w-6 h-6" />
            <span>{loading ? t("processing") : t("initiateDeposit")}</span>
          </button>
        </form>
      </div>

      <div className="bg-accent-800/50 text-red backdrop-blur-md rounded-2xl p-6 mb-8 border border-blue-700/50 space-y-6">
        <h2 className="text-red">{t("disclaimer")}</h2>
        <div className="m-[200px]"></div>
      </div>

      <BottomNav />
    </div>
  )
}

