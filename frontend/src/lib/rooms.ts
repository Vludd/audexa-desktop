import type { RoomOperation } from "@/types"
import { t } from "@/i18n"

const ROOM_OPERATION_TRANSLATION_KEYS = {
  starting: "common.starting",
  stopping: "common.stopping",
  pausing: "common.pausing",
} as const

export function getRoomOperationLabel(operation: RoomOperation): string {
  return t(ROOM_OPERATION_TRANSLATION_KEYS[operation])
}
