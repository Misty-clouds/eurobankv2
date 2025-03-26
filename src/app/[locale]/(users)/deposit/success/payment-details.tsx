"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

interface PaymentDetailsProps {
  paymentId: string
  paymentDetails: any
}

export default function PaymentDetails({ paymentId, paymentDetails }: PaymentDetailsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // If no payment details, just show the payment ID
  if (!paymentDetails) {
    return (
      <div className="mt-4 text-sm text-muted-foreground">
        <p>Payment ID: {paymentId}</p>
      </div>
    )
  }

  // Format the payment details for display
  const {
    payment_status,
    pay_address,
    price_amount,
    price_currency,
    pay_amount,
    pay_currency,
    created_at,
    updated_at,
    expiration_estimate_date,
  } = paymentDetails

  return (
    <div className="mt-4 w-full">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-4 py-2 text-sm font-medium text-left text-primary bg-secondary/30 rounded-lg hover:bg-secondary/50 focus:outline-none focus-visible:ring focus-visible:ring-primary/50"
      >
        <span>Payment Details</span>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isExpanded && (
        <div className="mt-2 p-4 bg-secondary/20 rounded-lg text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-muted-foreground">Payment ID:</div>
            <div className="text-primary font-mono text-xs break-all">{paymentId}</div>

            <div className="text-muted-foreground">Status:</div>
            <div className="text-primary capitalize">{payment_status}</div>

            <div className="text-muted-foreground">Amount:</div>
            <div className="text-primary">
              {price_amount} {price_currency?.toUpperCase()}
            </div>

            <div className="text-muted-foreground">Crypto Amount:</div>
            <div className="text-primary">
              {pay_amount} {pay_currency?.toUpperCase()}
            </div>

            <div className="text-muted-foreground">Payment Address:</div>
            <div className="text-primary font-mono text-xs break-all">{pay_address}</div>

            <div className="text-muted-foreground">Created:</div>
            <div className="text-primary">{new Date(created_at).toLocaleString()}</div>

            <div className="text-muted-foreground">Expires:</div>
            <div className="text-primary">{new Date(expiration_estimate_date).toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  )
}

