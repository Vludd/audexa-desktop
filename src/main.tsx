import React from "react"
import ReactDOM from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"

import App from "./App"
import { queryClient } from "@/lib/queryClient"
import { ThemeProvider } from "@/components/ThemeProvider"
import { AudioSystemProvider } from "@/context/AudioSystemContext"

import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AudioSystemProvider>
          <App />
        </AudioSystemProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)