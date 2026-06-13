import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework"
import { z } from "@medusajs/framework/zod"
import { createUserWorkflow } from "../../../../workflows/create-user"

export const CreateUserSchema = z.object({
  email: z.string(),
})

type CreateUserBody = z.infer<typeof CreateUserSchema>

export const POST = async (req: AuthenticatedMedusaRequest<CreateUserBody>, res: MedusaResponse) => {
  if (!req.auth_context?.auth_identity_id) {
    return res.status(401).json({ message: "Not authenticated" })
  }

  const user = await createUserWorkflow(req.scope).run({
    input: {
      email: req.body.email,
      auth_identity_id: req.auth_context.auth_identity_id,
    },
  })

  return res.status(200).json({ user })
}