import { create } from 'zustand'

interface VoiceMember {
  userId: number
  username: string
  hasCamera: boolean
  hasScreenShare: boolean
}

interface VoiceMembersState {
  membersByChannel: Record<number, VoiceMember[]>
  setMembers: (channelId: number, members: VoiceMember[]) => void
  clearChannel: (channelId: number) => void
  reset: () => void
}

export const useVoiceMembersStore = create<VoiceMembersState>((set) => ({
  membersByChannel: {},

  setMembers: (channelId, members) =>
    set((state) => ({
      membersByChannel: {
        ...state.membersByChannel,
        [channelId]: members,
      },
    })),

  clearChannel: (channelId) =>
    set((state) => {
      const { [channelId]: _removed, ...rest } = state.membersByChannel
      return { membersByChannel: rest }
    }),

  reset: () => set({ membersByChannel: {} }),
}))
