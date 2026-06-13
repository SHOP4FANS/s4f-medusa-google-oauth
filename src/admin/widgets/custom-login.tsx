import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, toast } from "@medusajs/ui"
import { decodeToken } from "react-jwt"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"
import { useEffect, useRef } from "react"

// Google auth provider identifier
const GOOGLE_AUTH_PROVIDER = "google"

const GoogleLogin = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const callbackProcessed = useRef(false)
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      if (isPending) {
        return
      }
      return await validateCallback()
    },
    onError: (error) => {
      console.error("Google authentication error:", error)
    },
  })

  const sendCallback = async () => {
    try {
      return await sdk.auth.callback(
        "user",
        GOOGLE_AUTH_PROVIDER,
        Object.fromEntries(searchParams)
      )
    } catch (error) {
      toast.error("Authentication failed")
      throw error
    }
  }

  const validateCallback = async () => {
    const token = await sendCallback()

    if (typeof token !== "string") {
      throw new Error()
    }

    const decodedToken = decodeToken(token) as { actor_id: string, user_metadata: Record<string, unknown> }
    const userExists = decodedToken.actor_id !== ""

    if (!userExists) {
      // Session cookie is sent automatically by the SDK
      await sdk.client.fetch("/custom-auth/admin/users", {
        method: "POST",
        body: {
          email: decodedToken.user_metadata?.email as string,
        },
      })

      // Refresh session so it reflects the newly created actor
      await sdk.auth.refresh()
    }

    navigate("/orders")
  }

  // Handle Google login button click
  const googleLogin = async () => {
    const result = await sdk.auth.login("user", GOOGLE_AUTH_PROVIDER, {})

    if (typeof result === "object" && "location" in result) {
      // Redirect to Google for authentication
      window.location.href = result.location
      return
    }

    if (typeof result !== "string") {
      // Result failed, show an error
      toast.error("Authentication failed")
      return
    }

    navigate("/app")
  }

  // Handle the redirection back from Google
  useEffect(() => {
    if (searchParams.get("code") && !callbackProcessed.current) {
      callbackProcessed.current = true
      mutateAsync()
    }
  }, [searchParams, mutateAsync])

  return (
    <>
      <hr className="bg-ui-border-base my-4" />
      <Button
        variant="secondary"
        onClick={googleLogin}
        className="w-full"
      >
        Login with Google
      </Button>
    </>
  )
}

export const config = defineWidgetConfig({
  zone: "login.after",
})

export default GoogleLogin