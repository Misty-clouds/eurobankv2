"use client"

import { useRouter } from "@/i18n/routing"
import { XCircle, ArrowLeft } from "lucide-react"
import BottomNav from "@/lib/components/BottomNav"
import { useTranslations } from "next-intl"

export default function DepositCancelPage() {
  const router = useRouter()
  const t = useTranslations("DepositPage")

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-secondary p-4 flex justify-between items-center mb-8 rounded-2xl">
          <div className="flex items-center space-x-4">
            <button onClick={() => router.push("/dashboard")} className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl text-primary font-bold">{t("depositCancelled")}</h1>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-blue-900/50 backdrop-blur-md p-8 rounded-2xl border border-blue-700/50 flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-red-600/20 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-12 h-12 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-primary mb-2">{t("depositCancelled")}</h2>
          <p className="text-muted-foreground text-center">{t("depositCancelledMessage")}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-4">
          <button
            onClick={() => router.push("/deposit")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all"
          >
            {t("tryAgain")}
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-secondary hover:bg-secondary/80 text-primary font-bold py-4 rounded-2xl transition-all"
          >
            {t("backToDashboard")}
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

