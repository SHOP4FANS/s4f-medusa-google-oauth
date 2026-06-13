import { 
  MedusaRequest,
  MedusaResponse,
  MedusaNextFunction,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"

export default async function validateCustomAuthProvider(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const authContext = (req as any).auth_context

    if (!authContext?.auth_identity_id) {
      return next(new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        "Not authenticated"
      ))
    }

    const query = req.scope.resolve("query")

    const { data: [authIdentity] } = await query.graph({
      entity: "auth_identity",
      fields: ["provider_identities.provider"],
      filters: {
        id: authContext.auth_identity_id,
      },
    }, {
      throwIfKeyNotFound: true,
    })

    const isGoogleProvider = authIdentity.provider_identities.some(
      (identity: { provider: string }) => identity?.provider === "google"
    )

    if (!isGoogleProvider) {
      return next(new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        "Invalid provider — only Google authentication is allowed"
      ))
    }

    next()
  } catch (error) {
    next(error)
  }
}