import { createWorkflow, transform, WorkflowResponse, when } from "@medusajs/framework/workflows-sdk"
import { createUsersWorkflow, setAuthAppMetadataStep } from "@medusajs/medusa/core-flows"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"

type WorkflowInput = {
  email: string
  auth_identity_id: string
}

export const createUserWorkflow = createWorkflow(
  "create-user",
  (input: WorkflowInput) => {
    const { data: existingUsers } = useQueryGraphStep({
      entity: "user",
      fields: ["id", "email"],
      filters: { email: input.email },
    })

    const userInput = transform({ input, existingUsers }, ({ input, existingUsers }) => ({
      exists: existingUsers.length > 0,
      existingUser: existingUsers[0] ?? null,
      createInput: { email: input.email },
    }))

    const createdUsers = when(userInput, (u) => !u.exists).then(() => {
      return createUsersWorkflow.runAsStep({
        input: { users: [{ email: input.email }] },
      })
    })

    const user = transform(
      { userInput, createdUsers },
      ({ userInput, createdUsers }) => {
        const resolvedUser = userInput.exists ? userInput.existingUser : createdUsers?.[0]

        if (!resolvedUser) {
          throw new Error("Unable to resolve created or existing user")
        }

        return resolvedUser
      }
    )

    const authUserInput = transform(
      { input, user },
      ({ input, user }) => ({
        authIdentityId: input.auth_identity_id,
        actorType: "user",
        value: user.id,
      })
    )

    setAuthAppMetadataStep(authUserInput)

    return new WorkflowResponse({ user })
  }
)
