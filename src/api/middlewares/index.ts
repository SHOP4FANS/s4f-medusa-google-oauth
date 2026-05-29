// src/api/middlewares.ts
import { defineMiddlewares, authenticate } from "@medusajs/framework/http"
import validateCustomAuthProvider from "./validate-custom-auth-provider"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/custom-auth/admin/users",
      methods: ["POST"],
      middlewares: [
        authenticate("user", "bearer", {
          allowUnregistered: true,
        }),
        validateCustomAuthProvider
      ],
    },
  ],
})