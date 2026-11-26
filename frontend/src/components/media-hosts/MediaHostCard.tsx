import { useState, type SubmitEvent } from "react"
import {
  Check,
  Monitor,
  Pencil,
  Trash2,
  Unlink,
  X,
} from "lucide-react"

import type { MediaHost } from "@/api/mediaHosts"
import DisplayCard from "@/components/media-hosts/DisplayCard"
import MediaHostDetails from "@/components/media-hosts/MediaHostDetails"
import MediaHostStatus from "@/components/media-hosts/MediaHostStatus"
import { Button } from "@/components/ui/button"
import { t } from "@/i18n"
import { Input } from "../ui/input"

interface Props {
  host: MediaHost
  busy: boolean
  onRename: (hostId: string, name: string) => Promise<void>
  onRevoke: (hostId: string) => Promise<void>
  onDelete: (hostId: string) => Promise<void>
  disabled?: boolean
}

export default function MediaHostCard({
  host,
  busy,
  onRename,
  onRevoke,
  onDelete,
  disabled = false,
}: Props) {
  const unpaired = host.status.toLowerCase() === "disabled"
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(host.name)
  const [actionError, setActionError] = useState("")

  const saveName = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = name.trim()
    if (!normalized || normalized === host.name) {
      setEditing(false)
      setName(host.name)
      return
    }

    setActionError("")
    try {
      await onRename(host.id, normalized)
      setEditing(false)
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : t("mediaHosts.actions.actionError"),
      )
    }
  }

  const revoke = async () => {
    if (!window.confirm(t("mediaHosts.actions.revokeConfirm", { name: host.name }))) return
    setActionError("")
    try {
      await onRevoke(host.id)
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : t("mediaHosts.actions.actionError"),
      )
    }
  }

  const remove = async () => {
    if (!window.confirm(t("mediaHosts.actions.deleteConfirm", { name: host.name }))) return
    setActionError("")
    try {
      await onDelete(host.id)
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : t("mediaHosts.actions.actionError"),
      )
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Monitor className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <form
                onSubmit={(event) => void saveName(event)}
                className="flex flex-wrap items-center gap-2"
              >
                <Input
                  autoFocus
                  required
                  maxLength={200}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="flex-1 px-2"
                  aria-label={t("mediaHosts.actions.name")}
                />
                <Button
                  type="submit"
                  disabled={busy || !name.trim() || disabled}
                  title={t("mediaHosts.actions.save")}
                  className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || disabled}
                  onClick={() => {
                    setEditing(false)
                    setName(host.name)
                    setActionError("")
                  }}
                  title={t("common.cancel")}
                  className="inline-flex size-8 items-center justify-center rounded-md border"
                >
                  <X className="size-4" />
                </Button>
              </form>
            ) : (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="truncate text-sm font-semibold text-foreground">
                  {host.name}
                </h2>
                <Button
                  variant="ghost"
                  disabled={busy || disabled}
                  onClick={() => {
                    setName(host.name)
                    setEditing(true)
                    setActionError("")
                  }}
                  title={t("mediaHosts.actions.rename")}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <Pencil className="size-3.5" />
                </Button>
              </div>
            )}
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {host.machineName}
            </p>
          </div>
        </div>
        <MediaHostStatus status={host.status} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <MediaHostDetails host={host} />
        {!unpaired ? (
          <Button
            variant="destructive"
            onClick={() => void revoke()}
            disabled={busy || disabled}
          >
            <Unlink className="size-3.5" />
            {t("mediaHosts.actions.unpair")}
          </Button>
        ) : (
          <Button
            variant="destructive"
            onClick={() => void remove()}
            disabled={busy || disabled}
          >
            <Trash2 className="size-3.5" />
            {t("mediaHosts.actions.delete")}
          </Button>
        )}
      </div>

      {actionError && (
        <p className="border-t bg-destructive/5 px-4 py-2 text-xs text-destructive">
          {actionError}
        </p>
      )}

      <div className="border-t bg-muted/20 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold">{t("mediaHosts.displays")}</p>
          <span className="text-[11px] text-muted-foreground">
            {host.displays.length}
          </span>
        </div>
        {host.displays.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            {t("mediaHosts.noDisplays")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {host.displays.map((display) => (
              <DisplayCard
                key={display.id}
                display={display}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
