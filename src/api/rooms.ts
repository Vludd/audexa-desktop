import type { Room } from "@/types"
import { apiRequest } from "@/api/client"

interface BackendRoom {
  id: string
  name: string
  audioFileId: string | null
  volume: number
}

export interface RoomRequest {
  name: string
  audioFileId: string | null
  volume: number
}

function mapRoom(
  room: BackendRoom,
): Room {
  return {
    id: room.id,
    name: room.name,
    status: "stopped",
    audioFileId: room.audioFileId,
    volume: room.volume,
    position: 0,
    duration: 0,
  }
}

export const roomsApi = {
  async getAll(): Promise<Room[]> {
    const rooms =
      await apiRequest<BackendRoom[]>(
        "/api/rooms",
      )

    return rooms.map(mapRoom)
  },

  async getById(
    id: string,
  ): Promise<Room> {
    const room =
      await apiRequest<BackendRoom>(
        `/api/rooms/${id}`,
      )

    return mapRoom(room)
  },

  async create(
    request: RoomRequest,
  ): Promise<Room> {
    const room =
      await apiRequest<BackendRoom>(
        "/api/rooms",
        {
          method: "POST",
          body: JSON.stringify({
            name: request.name,
            audioFileId:
              request.audioFileId,
            volume: request.volume,
          }),
        },
      )

    return mapRoom(room)
  },

  async update(
    id: string,
    request: RoomRequest,
  ): Promise<Room> {
    const room =
      await apiRequest<BackendRoom>(
        `/api/rooms/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: request.name,
            audioFileId:
              request.audioFileId,
            volume: request.volume,
          }),
        },
      )

    return mapRoom(room)
  },

  async delete(
    id: string,
  ): Promise<void> {
    await apiRequest<void>(
      `/api/rooms/${id}`,
      {
        method: "DELETE",
      },
    )
  },
}